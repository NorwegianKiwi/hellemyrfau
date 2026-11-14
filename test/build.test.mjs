import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const runBuild = (context, args = []) => spawnSync(process.execPath, ["scripts/build.mjs", ...args], {
  cwd: root, env: { ...process.env, CONTEXT: context }, encoding: "utf8"
});
const read = (path) => readFile(resolve(root, path));
const load = (name, version) => import(pathToFileURL(resolve(root, "build/functions", name)).href + "?" + version);

test("publiseringsbygg og isolering av forhåndsvisninger", async () => {
  const production = runBuild("production");
  assert.equal(production.status, 0, production.stderr);
  for (const name of ["index.html", "_redirects", "moter.ics", "dokumenter/smarttelefon-i-barneskolen.pdf", "fonts/sofia-sans-var.woff2"]) {
    assert.deepEqual(await read("dist/" + name), await read("fau-nettside/" + name));
  }
  assert.deepEqual(await read("dist/admin/index.html"), await read("fau-admin/admin/index.html"));
  const publicEntries = await readdir(resolve(root, "dist"));
  for (const name of ["README.md", "netlify.toml", "package.json", "node_modules", "netlify-funksjoner", "build", ".env", ".gitignore"]) {
    assert.ok(!publicEntries.includes(name), name + " skal ikke publiseres");
  }
  assert.deepEqual((await readdir(resolve(root, "build/functions"))).sort(), ["admin-api.mjs", "submission-created.mjs"]);
  const admin = await load("admin-api.mjs", "production");
  assert.deepEqual(admin.config.path, ["/api/admin", "/api/admin/konfig"]);
  const rejected = await admin.default(new Request("https://example.test/api/admin"));
  assert.equal(rejected.status, 401);
  const submission = await load("submission-created.mjs", "production");
  const ignored = await submission.default(new Request("https://example.test", {
    method: "POST", body: JSON.stringify({ payload: { form_name: "annet-skjema" } })
  }));
  assert.equal(ignored.status, 200);

  await writeFile(resolve(root, "dist/utdatert.txt"), "utdatert");
  await writeFile(resolve(root, "build/functions/utdatert.mjs"), "utdatert");
  for (const context of ["deploy-preview", "branch-deploy", ""]) {
    const preview = runBuild(context);
    assert.equal(preview.status, 0, preview.stderr);
    assert.ok(!(await readdir(resolve(root, "dist"))).includes("utdatert.txt"));
    assert.deepEqual((await readdir(resolve(root, "build/functions"))).sort(), ["admin-api.mjs", "submission-created.mjs"]);
    for (const name of ["admin-api.mjs", "submission-created.mjs"]) {
      const code = (await read("build/functions/" + name)).toString();
      assert.doesNotMatch(code, /@netlify|GOOGLE_CLIENT_ID|ADMIN_EPOSTER|getStore|fetch\(/);
      const fn = await load(name, context || "local");
      for (const method of ["GET", "POST", "DELETE"]) {
        const response = await fn.default(new Request("https://example.test/api/admin", { method }));
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal((await response.json()).klientId, null);
      }
    }
    assert.notEqual(runBuild(context || "dev", ["--production"]).status, 0);
  }
  assert.equal(runBuild("", ["--production"]).status, 0);
});
