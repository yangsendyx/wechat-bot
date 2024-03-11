import { botName } from '../../config.js'

const TIPS = `
有啥想知道的直接@${botName}提问ao ~
特殊技能参考下列使用方法:

1. 语音回复
eg. @BOT v1 如何用波斯语打招呼

2. 文生图
eg. @BOT v2 画一张小猫在夕阳下雪地里打滚的图

3. 图像解析
eg. @BOT v3 详细描述一下这张图 [图片链接]

4. 文档上传
eg. @BOT v4 [文档链接]

5. 文档问答
eg. @BOT v5 文档提问内容
`
.replace(/BOT/g, botName);

const privateTips = `
有啥想知道的直接发我 ao ~
特殊技能参考下列使用方法:

1. 语音回复
eg. 直接向我发送语音即可

2. 文生图
eg. v2 画一张小猫在夕阳下雪地里打滚的图

3. 图像解析
eg. v3 详细描述一下这张图 [图片链接]

4. 文档上传
eg. 直接向我发送文档即可

5. 文档问答
eg. v5 文档提问内容
`;

export default {
    public: TIPS,
    private: privateTips,
};