# 安装

clone 本项目, 在项目内部执行命令即可

## 安装deno

linux执行 `curl -fsSL https://deno.land/install.sh | sh` 安装 deno, 更多访问 https://docs.deno.com/runtime/


## 导出某服务器的所有配置到 host_port 目录

```
deno -A ./nacos-export.ts -U nacos -P pwd -u http://10.0.44.168:8848
```


## 导入现有配置到服务器的新命名空间

-n ns 是新的命名空间

-p 是从其他项目 export 出来的目录, cli 会检测它存在再继续

```
deno -A ./nacos-export.ts -U nacos -P pwd -u http://10.0.44.168:8848 -n test7 -p 10.1.160.238_57102/ACRSA_PRO_BETA
```
