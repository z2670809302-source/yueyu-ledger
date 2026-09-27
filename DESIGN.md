---
name: 月余
description: 一册温暖、克制、只属于自己的月度纸账本。
colors:
  vermilion: "#b6412f"
  vermilion-deep: "#8f2f22"
  income-green: "#176b54"
  paper: "#f2ead9"
  paper-light: "#fffaf0"
  ink: "#17202a"
  ink-muted: "#56615f"
  rule: "#d6cab5"
  on-dark: "#fdf7eb"
typography:
  display:
    fontFamily: '"LXGW WenKai Lite", serif'
    fontSize: "clamp(2.25rem, 8vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"LXGW WenKai Lite", serif'
    fontSize: "1.65rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"LXGW WenKai Lite", serif'
    fontSize: "1.16rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    fontSize: "0.88rem"
    fontWeight: 400
  control-input:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.04em"
  numerals:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif'
    fontSize: "clamp(2.2rem, 10vw, 4.25rem)"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "tabular-nums"
rounded:
  field: "10px"
  control: "12px"
  sheet: "14px"
  dialog: "18px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "10px"
  control: "12px"
  page: "18px"
  section: "21px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.paper-light}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  button-primary-active:
    backgroundColor: "{colors.vermilion-deep}"
    textColor: "{colors.paper-light}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  input-standard:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    typography: "{typography.control-input}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "46px"
  balance-sheet:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.sheet}"
    padding: "17px 20px 15px"
  add-action:
    backgroundColor: "{colors.vermilion}"
    textColor: "white"
    rounded: "{rounded.full}"
    size: "58px"
---

# Design System: 月余

## Overview

**Creative North Star: "掌心里的月度纸账本"**

月余把一本私人手写账本压缩进 iPhone：温暖纸张承载内容，近黑墨色建立秩序，朱砂红落在支出和关键动作上，深绿只标记收入与本机状态。整体克制、安静、实用，信息像按月誊写在同一张纸上，而不是被拆成通用财务仪表盘的悬浮统计卡和装饰性图表。

界面以清楚的数值关系为主角。书写感标题提供人味，系统无衬线体让控件、说明和金额保持快速可扫；细规则线、对齐的表格数字和一张深色余额单构成稳定节奏。首页只承担月度总览，逐笔流水进入对应分类的独立明细页。没有栅格图像，图标均为一致线重的自绘 SVG；随包字体使用 OFL 许可。

**Key Characteristics:**

- 温暖纸面与近黑墨色构成连续、低干扰的阅读底盘。
- 一张深色余额单承担全屏最强层级，其他内容回到纸上规则线。
- 朱砂红表示支出和主操作，深绿表示收入和本机可信状态。
- 文楷只用于标题和月份，正文、控件与金额坚持系统无衬线体。
- 移动端先行，固定底栏与中央圆形加号保证随手记一笔。
- 首页保持月度摘要，分类明细按具体日期倒序展开。
- 月度计划、余额实际支出与花呗递延额保持三种清楚可辨的数据状态。

## Colors

色彩来自纸、墨和记账批注：大面积低饱和，语义色少而明确。

### Primary

- **朱砂行动色** (`vermilion`): 用于主要按钮、支出方向标记和关键文字动作；它应稀少但立即可见。
- **深朱砂** (`vermilion-deep`): 用于按下状态、支出金额和当前导航，提供比主朱砂更稳的对比。

### Secondary

- **收入深绿** (`income-green`): 只用于收入、本机保存和隐私可信提示，保持财务方向的一致含义。

### Neutral

- **暖纸** (`paper`): 全局页面底色，保持账本的连续纸张感。
- **浅纸** (`paper-light`): 表单、底栏与弹层的较亮承载面。
- **近黑墨** (`ink`): 正文、规则强调和余额单背景。
- **褪墨** (`ink-muted`): 日期、说明、列标题与次级导航。
- **纸上规则线** (`rule`): 表格分隔、输入边框和小型结构线。
- **暗面米白** (`on-dark`): 余额单上的大金额与高优先级文字。

**The Two-Ink Rule.** 朱砂只表达支出或主操作，深绿只表达收入或本机可信状态；不要把它们当作无语义装饰色互换。

**The Paper Continuity Rule.** 页面主体保持整张暖纸，不把每一组数字包进独立白卡。

## Typography

**Display Font:** LXGW WenKai Lite（衬线回退）  
**Body Font:** Apple 系统字体 / PingFang SC（无衬线回退）  
**Numeral Font:** Apple 系统字体 / SF Pro Display / PingFang SC

**Character:** 文楷 700 带来手写账本的温度，只承担页名、章节标题和月份。系统字体处理说明、控件和全部数字，让紧凑数据保持清晰，金额统一使用等宽数字。

### Hierarchy

- **Display**（700，响应式大标题，行高 1）：只用于产品页名，形成轻巧但明确的开场。
- **Headline**（700，大标题）：用于弹层等需要更强局部起点的标题。
- **Title**（700，章节标题）：用于月度收支、明细和数据管理分区。
- **Body**（400，常规正文）：用于分类、说明与表单内容；交互文字可提升到 650–750。
- **Control Input**（400，1rem / 16px）：用于 iPhone 表单中的 `text`、`date`、`number` 和 `select` 控件，避免 Safari 聚焦时放大页面。
- **Label**（700，小号并轻微加宽）：用于日期、列标题、状态和字段名。
- **Numerals**（650，响应式超大金额，行高 1）：用于当前余额；所有财务数值启用 `tabular-nums` 以保持列对齐。

**The Split-Voice Rule.** 文楷负责账本的声音，系统无衬线负责操作和计算；不要让文楷进入密集表格、表单或金额。

**The No-Zoom Input Rule.** iPhone 表单的可聚焦 `text`、`date`、`number` 与 `select` 控件字号不得低于 16px。

## Layout

布局以 390 CSS px 的 iPhone 14 宽度为第一基准。页面左右留白为 18px，首页按单列顺序组织页名与状态、月份切换、余额单和六项分类表，不展示逐笔流水；底部为固定导航，并为安全区和底栏预留至少 112px 的内容空间。

分类使用三列表格，第一列左对齐，预计与实际右对齐；六个分类必须在固定导航上方连续出现，整行点击进入该分类的独立明细页。明细页顶部依次提供返回、分类名、月份和“记一笔”，其下用双列规则区显示预计与实际小计，再按具体日期倒序排列流水；同一天允许出现多条记录。常规分区间距为 21px，表格内部以 46px 最小行高形成可点按的纸上行距。桌面在 700px 起增加横向留白和分区间距，主体与底栏共同居中并封顶 760px；深色余额单内边距同步放大。

**The One-Sheet Rule.** 信息沿一张纸纵向展开；层级依靠标题、规则线和留白，不依靠多列仪表盘或卡片网格。

## Elevation & Depth

深度是少量结构提示，而不是表面装饰。余额单用柔和向下阴影从纸面抬起，主按钮用更短的朱砂投影强化可按性，固定底栏以向上的轻阴影和轻微模糊区分滚动内容；表格、数据分区和普通文本保持平面。

### Shadow Vocabulary

- **余额单柔影** (`0 12px 28px rgba(57, 45, 29, 0.11)`): 只用于主余额容器。
- **主按钮短影** (`0 7px 16px rgba(143, 47, 34, 0.18)`): 用于矩形主操作。
- **中央操作影** (`0 9px 20px rgba(143, 47, 34, 0.28)`): 用于底栏中央加号。
- **底栏上浮影** (`0 -10px 28px rgba(57, 45, 29, 0.08)`): 表达固定导航覆盖内容。
- **弹层上浮影** (`0 -18px 48px rgba(24, 26, 25, 0.24)`): 仅用于底部录入弹层。

**The Reserved Depth Rule.** 阴影只解释余额总览、主操作、固定导航或模态层级；规则表格和普通分区永远留在纸面上。

## Shapes

形状克制且带轻微手感。输入框使用 10px 圆角，按钮和分段控件使用 12px，余额单使用 14px，弹层使用 18px；圆形只留给图标按钮和中央加号。规则线通常为 1px，表格或分区起始线为 2px；收入和支出方向使用 5×22px 的圆头竖记号。

余额单右上角可保留一段低对比的大圆弧，作为纸账本世界中唯一的抽象装饰。所有图标使用无填充、圆端点、约 1.7–1.8 的一致线重。

**The Restrained Radius Rule.** 12–16px 是主要表面的圆角语言；不要把普通内容变成胶囊或过度圆润的卡片集合。

## Components

### Buttons

- **Shape:** 矩形操作使用 12px 圆角与 46px 最小高度；紧凑按钮可降到 38px；中央加号为 58px 圆形。
- **Primary:** 朱砂底、浅纸文字，常规水平内边距 18px；按下切换为深朱砂。
- **Focus / Active:** 键盘焦点使用半透明朱砂 3px 外框并外移 3px；中央加号按下向下移动 2px。
- **Secondary / Danger:** 次按钮为近黑描边的透明纸面；危险按钮使用柔和红褐描边和深朱砂文字。

### Cards / Containers

- **Balance Sheet:** 近黑墨面、14px 圆角、移动端内边距 17px 20px 15px；主金额和三列摘要由一条低对比规则线分开。
- **Ruled Sections:** 普通分区不设卡片背景，用 2px 顶线、1px 行线和自然纸面建立边界。
- **Dialog:** 浅纸背景，移动端为底部抽屉并只圆上角；桌面转为完整 18px 圆角居中模态框。

### Inputs / Fields

- **Standard Field:** 46px 最小高度、1px 规则线描边、10px 圆角、浅纸背景；`text`、`date`、`number` 与 `select` 控件字号至少 16px。
- **Amount Field:** 金额输入取消盒状边框，以 2px 墨线承托超大等宽数字。
- **Focus:** 与按钮共享朱砂外框，避免仅靠颜色深浅表达焦点。

### Monthly Plan Form

预计是“月份 + 分类”唯一的一份月度计划，不属于按日流水。预计模式隐藏日期、备注和支付方式，以只读“计划月份”块替代日期控件；重新打开同月同分类时回填现有总额，保存即覆盖该计划，危险操作文案使用“清除”而不是“删除流水”。当月还款的预计可叠加上月花呗派生额，并在详情中说明这部分金额的来源。

**The Monthly Plan Rule.** 预计只有月份和分类两个归属维度；不要为它伪造日级时间线或多条同类计划。

### Payment Method Segmented

实际支出中，除“当月还款”外的支出分类显示“余额支付 / 花呗”两段选择，并紧跟一句说明。默认选择余额支付；收入、预计和当月还款隐藏该控件并回到余额支付。分段控件沿用 12px 外框、9px 选中块和墨面反白状态。

### Huabei Notice

花呗是递延状态，不是新的强调色。首页分类实际列在主实际金额下以深朱砂小字显示“花呗 + 金额”；分类详情行使用“花呗 · 下月还款”标签，双列小计下方用规则线描边的通知解释去向。花呗消费不计入本月实际支出或当前余额，并自动加入下月“当月还款”的预计；下月还款详情在有派生额时显示“来自上月花呗消费”的来源说明。

**The Deferred Huabei Rule.** 花呗金额只能作为次级递延信息出现；不得混入本月实际合计或余额。

### Navigation

底部导航固定在视口底部，与内容同宽并封顶 760px。左右导航项用线性 SVG 图标和小号标签，默认褪墨，当前项为深朱砂；中央 58px 朱砂加号向上越出底栏，承担全局“记一笔”。从分类明细页触发时，加号预选当前分类；从首页触发时使用默认分类。底栏使用浅纸半透明面、14px 背景模糊和轻微上浮阴影。

### Category Actual Stack Row

分类行采用三列右对齐数字结构与 46px 最小行高。第一列以 5×22px 的圆头竖记号编码方向：收入为深绿，支出为朱砂。实际列允许垂直堆叠一行主实际金额与一行较小的花呗递延金额。整行是进入该分类明细页的唯一点击目标，按下只出现很淡的纸面提亮，不增加卡片或阴影。

### Category Detail Header

分类明细页使用三列顶部结构：左侧 44px 圆形返回按钮，中间是文楷分类名与“年份 月份 · 按日记录”，右侧是朱砂文字“记一笔”。紧随其后的预计总额与实际总额以两列规则区呈现，顶部 2px 墨线、底部 1px 墨线，中间用 1px 规则线分隔。

### Daily Detail Timeline

实际流水以具体日期作为分组标题并按日期倒序排列；同日多条记录保留为连续规则行。每行左侧显示备注，次行标明“实际”或“花呗 · 下月还款”，右侧显示带收支符号的金额与进入箭头。预计永远不出现在按日时间线中。顶部“记一笔”、全局加号和空状态“记第一笔”都必须预选当前分类。

## Do's and Don'ts

### Do:

- **Do** 让一张近黑余额单成为每个主账本视图的视觉锚点。
- **Do** 用规则线、对齐和等宽数字组织高密度财务信息。
- **Do** 在 390px 宽度优先验证六个分类、固定导航与中央加号的关系。
- **Do** 让分类整行进入独立明细，并在明细页按日期倒序保留同日多条记录。
- **Do** 把同月同分类的预计回填、覆盖或清除为唯一月度计划。
- **Do** 将花呗金额显示为次级递延信息，并说明其进入下月预计还款的来源。
- **Do** 在 390px iPhone 14 上保持所有可聚焦表单控件至少 16px。
- **Do** 使用同一套无填充、圆端点、等线重 SVG 图标。
- **Do** 保持 LXGW WenKai Lite 字体文件与 OFL 许可证随应用本地提供。

### Don't:

- **Don't** 用浮动统计卡、装饰性图表或多彩分类瓦片替代纸账本结构。
- **Don't** 把朱砂与深绿用于没有收支或可信状态含义的装饰。
- **Don't** 在密集正文、表单或金额中使用文楷。
- **Don't** 为普通表格行和数据分区添加阴影、渐变或独立白卡背景。
- **Don't** 在首页重新加入逐笔流水、日期分组或明细编辑入口。
- **Don't** 把预计放进按日流水，或把花呗消费计入本月实际支出和余额。
- **Don't** 引入栅格装饰资产；继续使用字体、CSS 和自绘 SVG 表达视觉世界。
