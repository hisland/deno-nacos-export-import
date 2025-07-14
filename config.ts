type ConfigItemType = {
  id: string;
  prefix: string;
  user: string;
  pass: string;
  importNS?: string;
  importPath?: string;
};

export const configList: ConfigItemType[] = [];
