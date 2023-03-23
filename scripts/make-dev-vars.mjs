import fs from "node:fs";
import path from "node:path";

const secrets_dirpath = path.join(process.cwd(), "secrets");

const json_filepaths = fs
  .readdirSync(secrets_dirpath)
  .filter((rfp) => rfp.endsWith(".json"))
  .map((rfp) => path.join(secrets_dirpath, rfp));

const txt_filepaths = fs
  .readdirSync(secrets_dirpath)
  .filter((rfp) => rfp.endsWith(".txt"))
  .map((rfp) => path.join(secrets_dirpath, rfp));

const strings = [];

json_filepaths.forEach((fp) => {
  const key = path.basename(fp, ".json").toUpperCase().replaceAll("-", "_");
  const s = fs.readFileSync(fp).toString();
  const value = s.replaceAll("\n", "").replaceAll(" ", "");
  // return `${key}=${value}`;
  strings.push(`${key}=${value}`);
});

txt_filepaths.forEach((fp) => {
  const key = path.basename(fp, ".txt").toUpperCase().replaceAll("-", "_");
  const s = fs.readFileSync(fp).toString();
  const value = s.replaceAll("\n", "").replaceAll(" ", "");
  strings.push(`${key}=${value}`);
});

// https://developers.cloudflare.com/workers/platform/environment-variables/
const outpath = path.join(process.cwd(), ".dev.vars");

fs.writeFileSync(outpath, strings.join("\n"), "utf8");
console.log(`✅ ${outpath} generated`);
