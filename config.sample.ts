export type ConfigItemType = {
  id: string
  prefix: string
  user: string
  pass: string
  importNS?: string
  importPath?: string
}

// 根据类型可以配置多个, id要唯一, 命令行根据id读取配置并使用
export const configList: ConfigItemType[] = [
  // {
  //   id: "id1",
  //   prefix: "http://10.0.33.22:57102",
  //   user: "nacos",
  //   pass: "pass",
  // },
]
