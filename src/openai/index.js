import OpenAI from "openai";
import dotenv from 'dotenv';
import axios from 'axios';
import { FileBox } from 'file-box';
import https from 'https';
import {
    createSpeech,
    markdownToText,
    judgeImgType,
    createFileAndIndex,
    getPathFromUrlOrFile,
} from './util.js';

const env = dotenv.config().parsed; // 环境参数
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_API_URL,
});

export async function getOpenAiWishper() {
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("audio.mp3"),
        model: "whisper-1",
    });
}

export async function getOpenAiReply(prompt, useAudio) {
    const resp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { "role": "system", content: "你是一个优秀的人工智能助手。" },
            { "role": "user", content: prompt }
        ]
    });
    const reply = markdownToText(resp.choices[0].message.content)
    if (!useAudio) return { text: reply };

    const buffer = await createSpeech(reply, prompt);
    const name = prompt.length > 9 ? prompt.substr(0, 10) + '...' : prompt;
    return { media: FileBox.fromBuffer(buffer, `${name}.mp3`) };
}

export async function getOpenAiImage(prompt) {
    const resp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { "role": "system", content: "你是一个优秀的dall-e-3模型的提示词专家，接下去需要你对这段prompt进行更加详细的优化。" },
            { "role": "user", content: prompt }
        ]
    });
    const nPrompt = resp.choices[0].message.content;
    // console.log('> o', prompt);
    // console.log('> n', nPrompt);

    const res = await openai.images.generate({
        model: "dall-e-3",
        prompt: nPrompt,
        n: 1,
        size: "1024x1024",
    });

    const name = prompt.length > 9 ? prompt.substr(0, 10) + '...' : prompt;
    const { data } = await axios.get(res.data[0].url, {
        responseType: 'arraybuffer'
    });
    return { media: FileBox.fromBuffer(data, `${name}.png`) };
}

export async function getOpenAiVision(prompt, imgUrl) {
    const { data } = await axios.get(imgUrl, {
        responseType: 'arraybuffer'
    });
    const type = judgeImgType(data);
    if (!type) throw new Error('[Error]: 链接图片异常');

    const resp = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        max_tokens: 4096,
        messages: [
            { "role": "system", content: "请用中文回答。" },
            { "role": "user", content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imgUrl } }
            ] },
        ],
    });

    // const name = prompt.length > 9 ? prompt.substr(0, 10) + '...' : prompt;
    return {
        text: markdownToText(resp.choices[0].message.content),
        // media: FileBox.fromBuffer(data, `${name}.${type}`),
    };
}

export async function uploadFileAndIndex(urlOrFile) {
    const path = await getPathFromUrlOrFile(urlOrFile);
    await createFileAndIndex(
        env.FASTGPT_USER,
        env.FASTGPT_PASS,
        env.FASTGPT_DATASET_ID,
        env.FASTGPT_WEBSITE,
        path,
    );
    return { text: '文件上传完毕，你现在可以用 v5 指令对我提问了。' };
}

export async function getDocReplyByFastGPT(prompt) {
    const { data } = await axios({
        type: 'POST',
        url: `${env.FASTGPT_WEBSITE}/api/v1/chat/completions`,
        data: {
            stream: false,
            detail: false,
            messages: [{ "role": "user", content: prompt }]
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.FASTGPT_APP_KEY}`,
        },
    });

    const reply = markdownToText(data.choices[0].message.content);
    return { text: reply };
}


