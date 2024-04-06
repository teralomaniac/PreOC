const rProxy_URL = '填入原反代地址';

const xmlPlot_merge = (content, mergeTag, nonsys) => {
    if (/(\n\n|^\s*)xmlPlot:\s*/.test(content)) {
        content = (nonsys ? content : content.replace(/(\n\n|^\s*)(?<!\n\n(Human|Assistant):.*?)xmlPlot:\s*/gs, '$1')).replace(/(\n\n|^\s*)xmlPlot: */g, mergeTag.system && mergeTag.human && mergeTag.all ? '\n\nHuman: ' : '$1' );
    }
    mergeTag.all && mergeTag.human && (content = content.replace(/(?:\n\n|^\s*)Human:(.*?(?:\n\nAssistant:|$))/gs, function(match, p1) {return '\n\nHuman:' + p1.replace(/\n\nHuman:\s*/g, '\n\n')}));
    mergeTag.all && mergeTag.assistant && (content = content.replace(/\n\nAssistant:(.*?(?:\n\nHuman:|$))/gs, function(match, p1) {return '\n\nAssistant:' + p1.replace(/\n\nAssistant:\s*/g, '\n\n')}));
    return content;
}, xmlPlot_regex = (content, order) => {
    let matches = content.match(new RegExp(`<regex(?: +order *= *${order})${order === 2 ? '?' : ''}> *"(/?)(.*)\\1(.*?)" *: *"(.*?)" *</regex>`, 'gm'));
    matches && matches.forEach(match => {
        try {
            const reg = /<regex(?: +order *= *\d)?> *"(\/?)(.*)\1(.*?)" *: *"(.*?)" *<\/regex>/.exec(match);
            content = content.replace(new RegExp(reg[2], reg[3]), reg[4].replace(/(\r\n|\r|\\n)/gm, '\n'));
        } catch (err) {
            console.log(`[33mRegex error: [0m` + match + '\n' + err);
        }
    });
    return content;
}, xmlPlot_PreOC = (content, nonsys = false) => {
    content = xmlPlot_regex(content, 1);
    const mergeTag = {
        all: !content.includes('<|Merge Disable|>'),
        system: !content.includes('<|Merge System Disable|>'),
        human: !content.includes('<|Merge Human Disable|>'),
        assistant: !content.includes('<|Merge Assistant Disable|>')
    };
    content = xmlPlot_merge(content, mergeTag, nonsys);
    let splitContent = content.split(/\n\n(?=Assistant:|Human:)/g), match;
    while ((match = /<@(\d+)>(.*?)<\/@\1>/gs.exec(content)) !== null) {
        let index = splitContent.length - parseInt(match[1]) - 1;
        index >= 0 && (splitContent[index] += '\n\n' + match[2]);
        content = content.replace(match[0], '');
    }
    content = splitContent.join('\n\n').replace(/<@(\d+)>.*?<\/@\1>/gs, '');
    content = xmlPlot_regex(content, 2);
    content = xmlPlot_merge(content, mergeTag, nonsys);
    content = xmlPlot_regex(content, 3);
    content = content.replace(/<regex( +order *= *\d)?>.*?<\/regex>/gm, '')
        .replace(/(\r\n|\r|\\n)/gm, '\n')
        .replace(/\\r/gm, '\r')
        .replace(/\s*<\|curtail\|>\s*/g, '\n')
        .replace(/\s*<\|join\|>\s*/g, '')
        .replace(/\s*<\|space\|>\s*/g, ' ')
        .replace(/\s*\n\n(H(uman)?|A(ssistant)?): +/g, '\n\n$1: ');
    return content.trim().replace(/^Human: *|\n\nAssistant: *$/g, '').replace(/(?<=\n)\n(?=\n)/g, '').replace(/\n\n(Human|Assistant):/g, '\n\r\n$1:');
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        const rProxyURL = new URL(rProxy_URL);
        url.host = rProxyURL.host;
        url.pathname = rProxyURL.pathname + url.pathname.replace(/^\/v1/, '');
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
                const prefix = message.customname ? message.role + ': ' + message.name + ': ' : 'system' !== message.role || message.name ? Replacements[message.name || message.role] + ': ' : 'xmlPlot: ' + Replacements[message.role];
                return `\n\n${prefix}${message.content}`;
            }));
            const prompt = prompts.join('');
            const processedprompt = xmlPlot_PreOC(prompt);
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
    } catch (error) {
        const errorResponse = new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        return errorResponse;
    }
}