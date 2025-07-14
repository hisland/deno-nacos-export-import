import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";
import * as fs from "jsr:@std/fs";

// @deno-types="https://cdn.skypack.dev/fflate@0.8.2/lib/index.d.ts"
import { unzipSync, strFromU8 } from "npm:fflate";

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
  .parse(Deno.args);

const { prefix, user, pass } = options;
console.log("url, user, pass: ", prefix, user, pass);

const url = new URL(prefix);
const host = url.hostname; // "10.1.160.221"
const port = url.port || (url.protocol === "https:" ? "443" : "80"); // "8848"
const dirName = `${host}_${port}`; // "10.1.160.221_8848"
console.log("dirName: ", dirName);

const exportRoot = path.join(Deno.cwd(), `${dirName}`);
console.log("exportRoot: ", exportRoot);

// 创建导出目录
Deno.mkdirSync(exportRoot, { recursive: true });

let loginState = {
  accessToken: "",
  tokenTtl: 2971,
  globalAdmin: true,
  username: "",
};

await doLogin(prefix, user, pass);
const namespaces = await doGetNamespaces(prefix);
console.log("namespaces: ", namespaces);

for (const ns of namespaces) {
  if (ns.namespace) {
    const namespaceExportRoot = path.join(exportRoot, ns.namespace);
    Deno.mkdirSync(namespaceExportRoot, { recursive: true });
    doExport(prefix, ns.namespace, namespaceExportRoot);
  }
}

async function doLogin(serverPrefix: string, user: string, pass: string) {
  const loginUrl = `${serverPrefix}/nacos/v1/auth/users/login`;
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(
      pass
    )}`,
  });

  if (loginRes.ok) {
    loginState = (await loginRes.json()) as LoginResultType;
    console.log("loginState: ", loginState);
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

async function doExport(
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
