// siteConfig.ts - 你的全站“控制中心”

export const siteConfig = {
  // 1. 网站标题与博主信息
  title: "曾子丞 · 个人空间",
  faviconUrl: "/favicon.png",
  authorName: "曾子丞",
  bio: "在数学、技术与摄影之间持续探索的学生。南方科技大学 · 深圳。",

  navTitle: "曾子丞",

  // 👇 【新增】导航栏中间的那个后缀/分隔符（默认是 の）
  navSuffix: "·",

  navAfter: "个人空间",

  // 2. 头像设置 (支持网络链接，或将图片放入 public 文件夹后使用 "/me.jpg")
  avatarUrl: "/avatar.webp",

  // 3. 网站背景设置 (二选一)
  // 如果想用纯图片背景，请在下面 bgImage 写路径，并将 useGradient 设为 false
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"], // 呼吸流动的颜色组合
// 修改这里：变成图片数组
  bgImages: ["/bg-1.webp", "/bg-2.webp", "/bg-3.webp", "/bg-4.webp"],

  // 4. 文章默认封面图 (当 Markdown 没写 cover 时显示)
  defaultPostCover: "/bg-1.webp",

  // 5. 首页照片墙预览图
  photoWallImage: "/bg-4.webp",
  social: {
    github: "",
    gitee: "",
    google: "",
    email: "",
    qq: "",
    wechat: "",
  },
  chatterTitle: "云端杂谈", // 你可以改成任何你喜欢的名字
  chatterDescription: "数学、技术、摄影与日常的碎片记录",
};
