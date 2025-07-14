import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";
import * as fs from "jsr:@std/fs";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

// @deno-types="https://cdn.skypack.dev/fflate@0.8.2/lib/index.d.ts"
import { unzipSync, zipSync } from "npm:fflate";

type LoginResultType = {
  accessToken: string;
  tokenTtl: number;
  globalAdmin: boolean;
  username: string;
};

type NamespaceType = {
  namespace: string;
  namespaceShowName: string;
  namespaceDesc: string;
  quota: number;
  configCount: number;
  type: number;
};

const { options } = await new Command()
  .name("nacos-import")
  .version("0.1.0")
  .description("导入本地 nacos 配置目录到远程 Nacos 服务器")
  .option(
    "-u, --prefix <prefix:string>",
    "服务前缀如 http://10.1.160.221:8848",
    { required: true }
  )
  .option("-U, --user <user:string>", "用户名", { required: true })
  .option("-P, --pass <pass:string>", "密码", { required: true })
  .option("-n, --importNS <importNS:string>", "导入的命名空间id")
  .option("-p, --importPath <importPath:string>", "导入的源配置目录")
  .parse(Deno.args);

const { prefix, user, pass, importNS, importPath } = options;
console.log("url, user, pass: ", prefix, user, pass);

let loginState = {
  accessToken: "",
  tokenTtl: 2971,
  globalAdmin: true,
  username: "",
};

const url = new URL(prefix);
const host = url.hostname;
const port = url.port || (url.protocol === "https:" ? "443" : "80");
const dirName = `${host}_${port}`;
console.log("dirName: ", dirName);

await doLogin(prefix, user, pass);

if (importNS) {
  console.log(`开始导入`);
  if (!importPath) {
    console.error(
      "请指定导入的源配置目录: -p 10.1.160.227_57102/ACRSA_PRO_ALPHA"
    );
    Deno.exit(1);
  }

  if (!fs.existsSync(importPath)) {
    console.error(`源配置目录 ${importPath} 不存在`);
    Deno.exit(1);
  }

  await doCreateNameSpace(prefix, importNS);
  const namespaces = await doGetNamespaces(prefix);
  console.log("namespaces: ", namespaces);
  await doImport(prefix, importNS, importPath);
} else {
  console.log(`开始导出`);
  const exportRoot = path.join(Deno.cwd(), `${dirName}`);
  console.log("exportRoot: ", exportRoot);
  Deno.mkdirSync(exportRoot, { recursive: true });
  const namespaces = await doGetNamespaces(prefix);
  console.log("namespaces: ", namespaces);
  for (const ns of namespaces) {
    if (ns.namespace) {
      const namespaceExportRoot = path.join(exportRoot, ns.namespace);
      Deno.mkdirSync(namespaceExportRoot, { recursive: true });
      doExportOne(prefix, ns.namespace, namespaceExportRoot);
    }
  }
}

async function doLogin(serverPrefix: string, user: string, pass: string) {
  const loginUrl = `${serverPrefix}/nacos/v1/auth/users/login`;
  const params = new URLSearchParams();
  params.append("username", user);
  params.append("password", pass);
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  // console.log("loginRes: ", loginRes);
  if (loginRes.ok) {
    loginState = (await loginRes.json()) as LoginResultType;
    console.log("loginState: ", loginState);
  }
}

async function doCreateNameSpace(serverPrefix: string, ns: string) {
  const loginUrl = `${serverPrefix}/nacos/v1/console/namespaces`;
  const params = new URLSearchParams();
  params.append("customNamespaceId", ns);
  params.append("namespaceName", ns);
  params.append("namespaceDesc", ns);
  params.append("namespaceId", "");
  const xhr1 = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      accesstoken: loginState.accessToken,
    },
    body: params.toString(),
  });

  console.log("xhr1: ", xhr1);
  if (xhr1.ok) {
    const createJson = await xhr1.json();
    console.log("createJson: ", createJson);
  }
}

async function doImport(serverPrefix: string, ns: string, zipPath: string) {
  const importUrl = new URL(`${serverPrefix}/nacos/v1/cs/configs`);
  importUrl.searchParams.set("import", "true");
  importUrl.searchParams.set("namespace", ns);
  importUrl.searchParams.set("accessToken", loginState.accessToken);
  importUrl.searchParams.set("username", loginState.username);
  importUrl.searchParams.set("tenant", ns);

  const zipData = await zipDirectory(zipPath);
  // console.log("zipData: ", zipData);
  const zipFile = new File([zipData], "aa.zip");
  // console.log("zipFile: ", zipFile);

  const formData = new FormData();
  formData.append("policy", "ABORT");
  formData.append("file", zipFile);

  const postUrl = importUrl.toString();
  console.log("postUrl: ", postUrl);
  const xhr1 = await fetch(postUrl, {
    method: "POST",
    headers: {},
    body: formData,
  });

  // console.log("xhr1: ", xhr1);
  if (xhr1.ok) {
    const importJson = await xhr1.json();
    console.log("importJson: ", importJson);
  }
}

async function doGetNamespaces(serverPrefix: string) {
  const loginUrl = `${serverPrefix}/nacos/v1/console/namespaces`;
  const loginRes = await fetch(loginUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      accesstoken: loginState.accessToken,
    },
  });

  if (loginRes.ok) {
    const data1 = await loginRes.json();
    return data1.data as NamespaceType[];
  } else {
    return [] as NamespaceType[];
  }
}

async function doExportOne(
  serverPrefix: string,
  tenant: string,
  exportRoot: string
) {
  const exportUrl1 = new URL("/nacos/v1/cs/configs", serverPrefix);
  exportUrl1.searchParams.set("exportV2", "true");
  exportUrl1.searchParams.set("tenant", tenant);
  exportUrl1.searchParams.set("group", "");
  exportUrl1.searchParams.set("appName", "");
  exportUrl1.searchParams.set("dataId", "");
  exportUrl1.searchParams.set("ids", "");
  exportUrl1.searchParams.set("accessToken", loginState.accessToken);
  exportUrl1.searchParams.set("username", loginState.username);

  const exportUrl = exportUrl1.toString();
  console.log("exportUrl: ", exportUrl);
  const xhr1 = await fetch(exportUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (xhr1.ok) {
    const data = new Uint8Array(await xhr1.arrayBuffer());

    // 保存 zip 文件
    // const exportRoot2 = path.join(exportRoot, `${tenant}.zip`);
    // await Deno.writeFile(exportRoot2, data);

    // 解压 zip 内容
    const entries = unzipSync(data);
    for (const [filename, file] of Object.entries(entries)) {
      const destPath = path.join(exportRoot, filename);
      if (file.length === 0) continue; // 跳过空文件夹（zip 不显式标记）
      await fs.ensureDir(path.join(destPath, ".."));
      await Deno.writeFile(destPath, file);
      console.log(`✓ Extracted ${filename}`);
    }
  }
}

async function zipDirectory(dirPath: string): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  for await (const entry of walk(dirPath, { includeDirs: false })) {
    const relPath = path.relative(dirPath, entry.path);
    // console.log("relPath: ", relPath);
    const fileData = await Deno.readFile(entry.path);
    // console.log("fileData: ", fileData);
    files[relPath] = fileData;
  }

  const zipRs = zipSync(files);
  return zipRs;
}
