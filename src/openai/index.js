import { remark } from 'remark'
import stripMarkdown from 'strip-markdown'
import OpenAI from "openai";
import dotenv from 'dotenv'
import { FileBox }  from 'file-box'

const env = dotenv.config().parsed // 环境参数
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_API_URL,
})

export async function getOpenAiReply(prompt, useAudio) {
    const resp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { "role": "system", content: "You are a personal assistant." },
            { "role": "user", content: prompt }
        ]
    })

    const reply = markdownToText(resp.choices[0].message.content)

    if (!useAudio) return { text: reply };
    return createSpeech(reply, prompt);
}

function markdownToText(markdown) {
    return remark()
        .use(stripMarkdown)
        .processSync(markdown ?? '')
        .toString()
}

async function createSpeech(text, prompt) {
    const audio = await openai.audio.speech.create({
        model: "tts-1",
        voice: "echo",
        input: text,
        response_format: 'mp3',
    });

    const name = prompt.length > 9 ? prompt.substr(0, 10) + '...' : prompt;
    const buffer = Buffer.from(await audio.arrayBuffer());
    return {
        text,
        audio: FileBox.fromBuffer(buffer, `${name}.mp3`),
    };
}


