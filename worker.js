const rProxy_URL = '填入原反代地址';

const FCxP = (content) => {
    // 检查内容中是否包含"<card>"
    const card = content.includes('<card>');

    //<card>越狱倒置
    if (card) {
        let segcontentHuman = content.split('\n\nHuman:');
        const seglength = segcontentHuman.length;
        if (/Assistant: *.$/.test(content) && seglength > 1 && !segcontentHuman[seglength - 2].includes('\n\nAssistant:')) {
            segcontentHuman[seglength - 2] = segcontentHuman.splice(seglength - 1, 1, segcontentHuman[seglength - 2])[0];
        }
        content = segcontentHuman.join('\n\nHuman:');
    }

    //role合并
    const MergeDisable = content.includes('<\!-- Merge Disable -->');
    const MergeHumanDisable = content.includes('<\!-- Merge Human Disable -->');
    const MergeAssistantDisable = content.includes('<\!-- Merge Assistant Disable -->');
    if (!MergeDisable) {
        if (content.includes('<\!-- Merge System Disable -->') || !card) {
            content = content.replace(/(\n\n|^)xmlPlot:\s*/gm, '$1');
        }
        if (!MergeHumanDisable) {
            content = content.replace(/(\n\n|^)xmlPlot:/g, '$1Human:');
            content = content.replace(/(?:\n\n|^)Human:(.*?(?:\n\nAssistant:|$))/gs, function(match, p1) {return '\n\nHuman:' + p1.replace(/\n\nHuman:\s*/g, '\n\n')});
            content = content.replace(/^\s*Human:\s*/, '');
        }
        if (!MergeAssistantDisable) {
            content = content.replace(/\n\nAssistant:(.*?(?:\n\nHuman:|$))/gs, function(match, p1) {return '\n\nAssistant:' + p1.replace(/\n\nAssistant:\s*/g, '\n\n')});
        }
    }
    content = content.replace(/(\n\n|^)xmlPlot:\s*/gm, '$1');
    content = content.replace(/<\!-- Merge.*?Disable -->/gm, '');

    //自定义插入
    content = content.replace(/(<\/?)PrevAssistant>/gm, '$1@1>');
    content = content.replace(/(<\/?)PrevHuman>/gm, '$1@2>');
    let splitContent = content.split(/\n\n(?=Assistant:|Human:)/g);
    let match;
    while ((match = /<@(\d+)>(.*?)<\/@\1>/gs.exec(content)) !== null) {
        let index = splitContent.length - parseInt(match[1]) - 1;
        if (index >= 0) {
            splitContent[index] += '\n\n' + match[2];
        }
        content = content.replace(match[0], '');
    }
    content = splitContent.join('\n\n');
    content = content.replace(/<@(\d+)>.*?<\/@\1>/gs, '');

    //正则
    while ((match = /<regex>"(\/?)(.*)\1(.*)" *: *"(.*?)"<\/regex>/gm.exec(content)) !== null) {
        try {
            content = content.replace(new RegExp(match[2], match[3]), match[4]);
        } catch (error) {}
        content = content.replace(match[0], '');
    }
    content = content.replace(/(\r\n|\r|\\n)/gm, '\n');

    //二次role合并
    if (!MergeDisable) {
        if (!MergeHumanDisable) {
            content = content.replace(/(?:\n\n|^)Human:(.*?(?:\n\nAssistant:|$))/gs, function(match, p1) {return '\n\nHuman:' + p1.replace(/\n\nHuman:\s*/g, '\n\n')});
        }
        if (!MergeAssistantDisable) {
            content = content.replace(/\n\nAssistant:(.*?(?:\n\nHuman:|$))/gs, function(match, p1) {return '\n\nAssistant:' + p1.replace(/\n\nAssistant:\s*/g, '\n\n')});
        }
    }

    //Plain Prompt去除
    content = content.replace(/<\!-- Plain Prompt Enable -->/gm, '');
    content = content.replace(/^PlainPrompt:/, '');
    content = content.replace(/\n\nPlainPrompt:/gm, '\n\nHuman:');

    //<card>群组
    if (!card) {
        content = content.replace(/(?<=\n\n(H(?:uman)?|A(?:ssistant)?)):[ ]?/g, '： ');
        content = content.replace(/(<reply>\n|\n<\/reply>)/g, '');
        return content.replace(/<customname>(.*?)<\/customname>/gm, '$1');
    } else {
        content = content.replace(/(<reply>\n|\n<\/reply>)\1*/g, '$1');
        content = content.replace(/<customname>(.*?)<\/customname>:/gm, '$1:\n');
    }

    //<card>在第一个"[Start a new"前面加上"<example>"，在最后一个"[Start a new"前面加上"</example>\n\n<plot>\n\n"
    const cardtag = content.match(/(?=\n\n<\/card>)/) || '</card>';
    const exampletag = content.match(/(?=\n\n<\/example>)/) || '</example>';
    const plot = content.includes('</plot>') ? '<plot>' : '';
    const firstChatStart = content.indexOf('\n\n[Start a new');
    const lastChatStart = content.lastIndexOf('\n\n[Start a new');
    firstChatStart != -1 && firstChatStart === lastChatStart && (content = content.slice(0, firstChatStart) + `\n\n${cardtag}` + content.slice(firstChatStart));
    firstChatStart != lastChatStart && (content = content.slice(0, firstChatStart) + `\n\n${cardtag}\n<example>` + content.slice(firstChatStart, lastChatStart) + `\n\n${exampletag}\n\n${plot}` + content.slice(lastChatStart));
    
    //<card>消除空XML tags、两端空白符和多余的\n
    content = content.replace(/\s*<\|curtail\|>\s*/g, '\n');
    content = content.replace(/\n<\/(card|hidden|META)>\s+?<\1>\n/g, '');
    content = content.replace(/\n<(\/?card|example|hidden|plot|META)>\s+?<\1>/g, '\n<$1>');
    content = content.replace(/(?:<!--.*?-->)?\n<(card|example|hidden|plot|META)>\s+?<\/\1>/g, '');
    content = content.replace(/(?<=(: |\n)<(card|hidden|example|plot|META|EOT)>\n)\s*/g, '');
    content = content.replace(/\s*(?=\n<\/(card|hidden|example|plot|META|EOT)>(\n|$))/g, '');
    content = content.replace(/(?<=\n)\n(?=\n)/g, '');

    content = content.replace(/(?<=\n\n(H(?:uman)?|A(?:ssistant)?)):[ ]?/g, '： ');
    return content.trim();
};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const rProxyURL = new URL(rProxy_URL);
    url.host = rProxyURL.host;
    url.protocol = rProxyURL.protocol;
    url.port = request.port;

    let body;
    if (request.body) {
        const reader = request.body.getReader();
        const chunks = [];
        let totalBytes = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
            totalBytes += value.length;
        }
        const buffer = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        const reqbody = JSON.parse(new TextDecoder().decode(buffer, { stream: true }));

        const {messages} = reqbody;
        const messagesClone = JSON.parse(JSON.stringify(messages));
        const Replacements = {
            user: 'Human',
            assistant: 'Assistant',
            system: '',
            example_user: 'H',
            example_assistant: 'A'
        };
        const prompts = messagesClone.map(((message) => {
            if (message.content.length < 1) {
                return message.content;
            }
            const prefix = message.customname ? message.role + ': <customname>' + message.name + '</customname>: ' : 'system' !== message.role || message.name ? Replacements[message.name || message.role] + ': ' : 'xmlPlot: ' + Replacements[message.role];
            return `\n\n${prefix}${message.customname ? '<reply>\n' + message.content.trim() + '\n</reply>' : message.content}`;
        }));
        const prompt = prompts.join('').replace(/(\r\n|\r|\\n)/gm, '\n').trim();
        const processedprompt = FCxP(prompt);
        const message = [
            { role: 'user', content: processedprompt }
        ];
        body = JSON.stringify(Object.assign({}, reqbody, { messages: message }));
    }

    let modifiedRequest = new Request(url.toString(), {
        headers: request.headers,
        method: request.method,
        body: body,
        redirect: 'follow'
    });
   
    const response = await fetch(modifiedRequest);
    const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    });
  
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  
    return modifiedResponse;
}
