// import { getChatGPTReply as getReply } from '../chatgpt/index.js'
import {
    getOpenAiReply,
    getOpenAiImage,
    getOpenAiVision,
    getOpenAiWishper,
    uploadFileAndIndex,
    getDocReplyByFastGPT,
} from '../openai/index.js'
import Tips from '../openai/tips.js'
import { botName, roomWhiteList, aliasWhiteList } from '../../config.js'
import { bot } from './index.js';


/**
 * 默认消息发送
 * @param msg
 * @param bot
 * @returns {Promise<void>}
 */

const botReg = new RegExp(`@${botName}`);
const triggerReg = /^(人工智能|AI助手|AI|ai|教程|提示)$/

export async function defaultMessage(msg, bot) {
    const room = msg.room() // 是否是群消息
    const contact = msg.talker() // 发消息人
    const content = msg.text() // 消息内容
    // 房间名称 发消息人昵称 发消息人名称
    const [roomName = null, remarkName, name] = await Promise.all([
        room?.topic(),
        contact.alias(),
        contact.name(),
    ]);
    const alias = remarkName || name // 发消息人昵称
    const isRoom = roomWhiteList.includes(roomName) && content.includes(`@${botName}`) // 是否在群聊白名单且@机器人
    const isAlias = aliasWhiteList.includes(remarkName) || aliasWhiteList.includes(name) // 发消息的人是否在联系人白名单内

    const isBotSelf = botName === remarkName || botName === name // 是否是机器人自己
    const isPublic = room && isRoom; // 群聊且允许回复
    const isPrivate = !room && isAlias; // 私聊且允许回复

    // 机器人自己 || 群聊非白名单 || 私聊非白名单
    if (isBotSelf || (!isPublic && !isPrivate)) return;
    // 消息类型验证不通过
    const verifyType = await verifyMsgType(msg, bot, isPrivate);
    if (!verifyType) return;

    const obj = room ? room : contact;
    const con = (room ? content.replace(botReg, '') : content)?.trim?.();
    const member = room ? await room.member({ name }) : undefined;

    // 预设关键词提示用法
    if (triggerReg.test(con)) {
        const tips = isPrivate ? Tips.private : Tips.public;
        return (await obj?.say(tips, member));
    }

    console.log(
        '>', room ? `room: ${roomName}` : `alias: ${alias}`, '|',
        verifyType === 1 ? con : { 2: 'Audio', 3: 'File' }[verifyType],
    );
    try {
        const { text, media } = (await getReply(con, isPrivate, msg, bot)) || {};
        if (media) await obj?.say(media);
        if (text) await obj?.say(text, member);
    } catch (e) {
        console.error(e)
        if (e?.message?.indexOf(`Azure OpenAI's content management policy`) !== -1) {
            obj?.say('触发Azure的政策拦截了~ 换个问题吧！\n┓( ´∀` )┏', member);
        } else if (e?.message?.indexOf('[Error]:') === 0) {
            obj?.say(e?.message.replace('[Error]:', '')?.trim?.(), member);
        } else {
            obj?.say('我出错了，等会再问吧\no(╥﹏╥)o', member);
        }
    }
}

async function verifyMsgType(msg, bot, isPrivate) {
    /* 
    Unknown = 0,
    Attachment  = 1,    // Attach(6),
    Audio       = 2,    // Audio(1), Voice(34)
    Contact     = 3,    // ShareCard(42)
    ChatHistory = 4,    // ChatHistory(19)
    Emoticon    = 5,    // Sticker: Emoticon(15), Emoticon(47)
    Image       = 6,    // Img(2), Image(3)
    Text        = 7,    // Text(1)
    Location    = 8,    // Location(48)
    MiniProgram = 9,    // MiniProgram(33)
    GroupNote   = 10,   // GroupNote(53)
    Transfer    = 11,   // Transfers(2000)
    RedEnvelope = 12,   // RedEnvelopes(2001)
    Recalled    = 13,   // Recalled(10002)
    Url         = 14,   // Url(5)
    Video       = 15,   // Video(4), Video(43)
    Post        = 16,   // Moment, Channel, Tweet, etc
    */
    const type = msg.type(); // 消息类型
    if (type === bot.Message.Type.Text) return 1;
    if (type === bot.Message.Type.Audio && isPrivate) return 2;
    if (type === bot.Message.Type.Attachment && isPrivate) return 3;
    return 0;
}

async function getReply(content, isPrivate, msg, bot) {
    if (!isPrivate) return (await getReplyPublic(content));
    return (await getReplyPrivate(content, msg, bot));
}

async function getReplyPrivate(content, msg, bot) {
    const type = msg.type();
    if (type === bot.Message.Type.Audio) {
        const file = await msg.toFileBox();
        return (await getOpenAiWishper(file));
    }
    if (type === bot.Message.Type.Attachment) {
        const file = await msg.toFileBox();
        return (await uploadFileAndIndex(file));
    }

    const [, _cmd, _text] = content?.match?.(/^([vV]\d+)([\s\S]+)?$/) || [];
    const cmd = _cmd?.toLocaleLowerCase?.();
    if (!cmd || /^v(1|2|3|4|5)$/.test(cmd)) {
        return (await getReplyPublic(content));
    }
}

async function getReplyPublic(content) {
    const [, _cmd, _text] = content?.match?.(/^([vV]\d+)([\s\S]+)?$/) || [];
    const cmd = _cmd?.toLocaleLowerCase?.();

    let text = _text?.trim?.() || content;
    let url = '';

    if (cmd === 'v3' || cmd === 'v4') {
        url = getUrl(text);
        if (!url) throw new Error('[Error]: 你还没给我地址呢！！！\n╮(╯▽╰)╭');
        if (cmd === 'v3') {
            text = text.replace(url, '')?.trim?.();
            if (!text) throw new Error('[Error]: 你想通过这个链接了解些什么？\n╮(╯▽╰)╭');
        }
    }

    // console.log('> ', cmd, '\n|', text, '\n|', url);
    if (!cmd) return (await getOpenAiReply(text, false));
    if (cmd === 'v1') return (await getOpenAiReply(text, true));
    if (cmd === 'v2') return (await getOpenAiImage(text));
    if (cmd === 'v3') return (await getOpenAiVision(text, url));
    if (cmd === 'v4') return (await uploadFileAndIndex(url));
    if (cmd === 'v5') return (await getDocReplyByFastGPT(text));
}

function getUrl(s) {
    var reg = /(http:\/\/|https:\/\/)((\w|=|\?|\.|\/|&|-)+)/g;
    var reg = /(https?|http):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g;
    s = s.match(reg);
    return s?.[0]?.trim?.();
}



