# 安装

## 1. 安装deno

linux 执行 `curl -fsSL https://deno.land/install.sh | sh` 安装 deno, 更多访问 https://docs.deno.com/runtime/

## 2. 安装本应用

`deno install --global -A https://raw.githubusercontent.com/hisland/deno-nacos-export-import/refs/heads/main/nacos-export.ts`

# 使用

## 1. 初始化配置文件

`nacos-export init` 会生成 config.ts, 照着模板将 nacos 的 url 账号 密码写入配置文件, 并给一个唯一id方便使用

## 2. 导出某服务器的所有配置到 host_port 目录

`nacos-export export -i 227` 将读取 config.ts 里面id为227的配置并导出所有的命令空间到本地


## 3. 导入现有配置到服务器的新命名空间

`nacos-export import -i 168 -n test2 -p 10.1.123.231_8848/ACRSA_PRO_ALPHA` 会将本地目录 `10.1.123.231_8848/ACRSA_PRO_ALPHA` 里面的配置导入到 id为168的 test2 命名空间里面, 有相同配置是取的 ABORT 

`nacos-export import -i 168` 会将 配置文件中配置的 `importPath` 路径的配置导入到 id为168的 `importNS` 指定的命名空间里面, 有相同配置是取的 ABORT 
