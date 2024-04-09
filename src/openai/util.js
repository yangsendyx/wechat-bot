import { remark } from 'remark'
import stripMarkdown from 'strip-markdown'
import path from 'path';
import { fileURLToPath } from "url";
import { FileBox } from 'file-box';
import dotenv from 'dotenv'
import micSdk from 'microsoft-cognitiveservices-speech-sdk';
import puppeteer, { executablePath } from 'puppeteer';
import fs from 'fs';
import WXVoice from 'wx-voice';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = dotenv.config().parsed; // 环境参数
const speechConfig = micSdk.SpeechConfig.fromSubscription(
    env.AZURE_SPEECH_KEY,
    env.AZURE_SPEECH_REGION,
);
speechConfig.speechSynthesisOutputFormat = 5;
speechConfig.speechSynthesisVoiceName = "zh-CN-XiaoxiaoMultilingualNeural";
// speechConfig.speechSynthesisVoiceName = "zh-CN-XiaoxiaoNeural";
// speechConfig.speechSynthesisVoiceName = "zh-CN-henan-YundengNeural";

const getType = {
    jpeg: function (uint8Array) {
        // const uint8Array = new Uint8Array(buffer);
        const len = uint8Array.length;
        if (
            numToHex(uint8Array[0]) === "FF" &&
            numToHex(uint8Array[1]) === "D8" &&
            numToHex(uint8Array[len - 2]) === "FF" &&
            numToHex(uint8Array[len - 1]) === "D9"
        ) {
            return "jpeg";
        }
        return null;
    },

    png: function (uint8Array) {
        // const uint8Array = new Uint8Array(buffer);
        const magic = ["89", "50", "4E", "47", "0D", "0A", "1A", "0A"];
        const magicLen = magic.length;
        let isMatch = true;
        for (let i = 0; i < magicLen; i++) {
            if (magic[i] !== numToHex(uint8Array[i])) {
                isMatch = false;
                break;
            }
        }
        if (isMatch) {
            return "png";
        }
        return null;
    },
};

function numToHex(number) {
    let result = number.toString(16);
    return result.padStart(2, "0").toUpperCase();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function judgeImgType(buffer) {
    const keys = Object.keys(getType);
    const uint8Array = new Uint8Array(buffer);

    for (let i = 0; i < keys.length; i++) {
        const type = getType[keys[i]](uint8Array);
        if (type) return type;
    }

    return null;
}

export function markdownToText(markdown) {
    return remark()
        .use(stripMarkdown)
        .processSync(markdown ?? '')
        .toString()
}

export async function createSpeech(text) {
    const buffer = await (new Promise((r, j) => {
        const synthesizer = new micSdk.SpeechSynthesizer(speechConfig);
        synthesizer.speakTextAsync(
            text,
            res => {
                synthesizer.close();
                r(Buffer.from(res.audioData));
            },
            err => {
                synthesizer.close();
                j(err);
            }
        );
    }));

    return buffer;
}

export async function createFileAndIndex(
    user,
    pass,
    datasetId,
    site,
    filePath,
) {
    const browser = await puppeteer.launch({
        executablePath: executablePath(),
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    });
    const page = (await browser.pages())?.[0];

    try {
        page.setViewport({ width: 1920, height: 1080 });
        page.setDefaultNavigationTimeout(1000 * 30);
        page.setDefaultTimeout(1000 * 30);

        // login
        await page.goto(`${site}/login`, { waitUntil: 'networkidle2' });
        await page.type('input.css-1r9e15p[name="username"]', user);
        await page.type('input.css-1r9e15p[name="password"]', pass);
        await page.keyboard.press('Enter');
        await page.waitForNavigation();

        // select file & next
        await page.goto(`${site}/dataset/detail?datasetId=${datasetId}&currentTab=import&source=fileLocal`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('div.css-n92xud input[type="file"]');
        await (await page.$('div.css-n92xud input[type="file"]')).uploadFile(filePath);
        await sleep(200);

        await page.waitForSelector('button.css-gj65it:not([disabled])');
        await page.click('button.css-gj65it:not([disabled])');
        await sleep(200);

        // split & next
        await page.waitForSelector('button.css-gj65it:not([disabled])');
        await page.click('button.css-gj65it:not([disabled])');
        await sleep(200);

        // upload & next
        await page.waitForSelector('button.css-gj65it:not([disabled])');
        await page.click('button.css-gj65it:not([disabled])');

        // wait for create index
        await page.waitForSelector('table.chakra-table tbody tr:nth-child(2) td:nth-child(5) div.css-c0i2cr');
        fs.unlinkSync(filePath);
    } catch (error) {
        await page.screenshot({
            path: `${__dirname}/../../files/1.png`,
            fullPage: true,
        });
        await browser.close();
        fs.unlinkSync(filePath);
        throw error;
    }
}

export async function getPathFromUrlOrFile(urlOrFile, isAudio) {
    const accept = ['txt', 'docx', 'csv', 'pdf', 'md', 'html'];
    const basePath = path.resolve(`${__dirname}/../../files`);
    let filePath = '';

    if (typeof urlOrFile === 'string' && /http/.test(urlOrFile)) {
        const name = urlOrFile.split('/').pop().split('?')[0];
        const type = name?.split('.')?.pop();
        if (!type || !accept.find(s => s === type)) {
            throw new Error('[Error]: 该链接文件类型不支持');
        }
        
        filePath = `${basePath}/${name}`;
        const file = FileBox.fromUrl(urlOrFile);
        await file.toFile(filePath);
    }

    if (urlOrFile._name && urlOrFile.buffer) {
        const type = urlOrFile._name?.split('.')?.pop();
        if (!isAudio && (!type || !accept.find(s => s === type))) {
            throw new Error('[Error]: 该文件类型不支持');
        }

        filePath = `${basePath}/${urlOrFile._name}`;
        await urlOrFile.toFile(filePath);
    }

    if (!filePath) throw new Error('[Error]: 保存文件异常！');
    return filePath;
}

export async function silk2mp3(path) {
    const arr = path.split('/');
    const name = arr.pop().split('.')[0];
    const nPath = `${arr.join('/')}/${name}.mp3`;
    
    return new Promise((r, j) => {
        const voice = new WXVoice();
        voice.on('error', err => j(err));
        voice.decode(
            path,
            nPath,
            { format: 'mp3' },
            file => {
                fs.unlinkSync(path);
                r(nPath);
            },
        );
    });
}

