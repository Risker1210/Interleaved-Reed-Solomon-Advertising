const bleno = require('bleno');
const rs = require('./reedsolomon.js');
const readline = require('readline');

function RS(messageLength, eccLength) {
    const dataLength = messageLength - eccLength;
    const encoder = new rs.ReedSolomonEncoder(rs.GenericGF.AZTEC_DATA_8());
    const decoder = new rs.ReedSolomonDecoder(rs.GenericGF.AZTEC_DATA_8());

    return {
        dataLength,
        messageLength,
        eccLength,
        encode: data => encoder.encode(data, eccLength),
        decode: data => decoder.decode(data, eccLength)
    };
}

function toHexString(integer) {
    return '0x' + integer.toString(16).padStart(2, '0');
}
function splitMessage(message, length = 25) {
    const messageArray = [];
    for (let i = 0; i < message.length; i += length) {
        let segment = message.slice(i, Math.min(i + length, message.length));
        if (segment.length < length) {
            segment = Buffer.concat([segment, Buffer.from(' '.repeat(length - segment.length))]);
        }
        messageArray.push(segment);
    }
    return messageArray;
}
function interleaverTest(messages, blockSize) {
    const maxMessageLength = messages.reduce((max, msg) => Math.max(max, msg.length), 0);
    messages = messages.map(msg => {
        const paddingLength = maxMessageLength - msg.length;
        return Buffer.concat([msg, Buffer.alloc(paddingLength, ' ')]);
    });
    
    const interleaved = Buffer.alloc(messages.length * maxMessageLength);

    // Interleave the messages
    for (let i = 0; i < maxMessageLength; i++) {
        for (let j = 0; j < messages.length; j++) {
            const blockStart = j * blockSize;
            const offset = (i % blockSize) + blockStart;
            interleaved[i * messages.length + j] = messages[j][offset];
        }
    }

    return interleaved;
}
function interleaverTest1(messages, blockSize) {
    const messageLength = messages[0].length;
    const interleaved = Buffer.alloc(messages.length * messageLength);
    // Interleave the messages
    for (let i = 0; i < messageLength; i++) {
        for (let j = 0; j < messages.length; j++) {
            const srcIndex = i + j * messageLength;
            const destIndex = j + i * messages.length;
            interleaved[destIndex] = messages[j][i];
        }
    }

    return interleaved;
}
function interleaver(messages, blockSize) {
    const messageLength = messages[0].length;
    const totalLength = messages.length * messageLength;
    const interleavedBuffers = [];
    for (let i = 0; i < messages.length; i++) {
        interleavedBuffers.push(Buffer.alloc(messageLength));
    }
    // Interleave the messages
    for (let i = 0; i < messageLength; i++) {
        for (let j = 0; j < messages.length; j++) {
            const srcIndex = i;
            const destIndex = (i * messages.length + j) % totalLength;
            const destBufferIndex = Math.floor((i * messages.length + j) / messageLength);

            interleavedBuffers[destBufferIndex][destIndex % messageLength] = messages[j][srcIndex];
        }
    }
    return interleavedBuffers;
}



let reedN = 25;
let reedK = 19;
let blockSize = 25;

function reedSolomonEncode(messages, k = reedK, n = reedN) {
    const rsEncoder = RS(n, n-k);
    const encoded = new Uint8Array(rsEncoder.messageLength);
    messages.copy(encoded, 0);
    rsEncoder.encode(encoded);
    //console.log('messages', messages);
    //console.log('encoded', encoded);
    return encoded;
}


function interleavedEncode(messages, b = blockSize, k = reedK, n = reedN) {
    const rsEncoder = RS(n, n-k);    
    msgs = splitMessage(Buffer.from(messages), k);
    let encodedMessages = [];
    for (let i = 0; i < msgs.length; i++) {
        //encodedMessages = Buffer.concat([Buffer.from(encodedMessages), reedSolomonEncode(msgs[i], k, n)]);
	encodedMessages.push(Buffer.from(reedSolomonEncode(msgs[i], k, n)));
    }
    console.log('encodedMessages', encodedMessages);
    const interleaved = interleaver(encodedMessages, b); 
    return interleaved;
    
    //const interleaved = interleaver(messages, b);
    //const rsEncoder = RS(n, n-k);
    //const encoded = new Uint8Array(rsEncoder.messageLength);
    //interleaved.copy(encoded, 0);
    //rsEncoder.encode(encoded);
    //return encoded;
}

const basicInfo = Buffer.from([0x1e, 0x16, 0xfa, 0xff, 0x0d]);
const tagore = 'Where the mind is without fear and the head is held high\nWhere knowledge is free\nWhere the world has not been broken up into fragments by narrow domestic walls\nWhere words come out from the depth of truth\nWhere tireless striving stretches its arms towards perfection\nWhere the clear stream of reason has not lost its way\nInto the dreary desert sand of dead habit\nWhere the mind is led forward by thee\nInto ever-widening thought and action\nInto that heaven of freedom, my Father, let my country awake\n';


const humanRightDeclaration = 'Whereas recognition of the inherent dignity and of the equal and inalienable rights of all members of the human family is the foundation of freedom, justice and peace in the world,\n\n Whereas disregard and contempt for human rights have resulted in barbarous acts which have outraged the conscience of mankind, and the advent of a world in which human beings shall enjoy freedom of speech and belief and freedom from fear and want has been proclaimed as the highest aspiration of the common people,\n Whereas it is essential, if man is not to be compelled to have recourse, as a last resort, to rebellion against tyranny and oppression, that human rights should be protected by the rule of law,\n\n Whereas it is essential to promote the development of friendly relations between nations,\n\n Whereas the peoples of the United Nations have in the Charter reaffirmed their faith in fundamental human rights, in the dignity and worth of the human person and in the equal rights of men and women and have determined to promote social progress and better standards of life in larger freedom,\n\n Whereas Member States have pledged themselves to achieve, in co-operation with the United Nations, the promotion of universal respect for and observance of human rights and fundamental freedoms,\n\n Whereas a common understanding of these rights and freedoms is of the greatest importance for the full realization of this pledge,\n\n Now, therefore,\n\n The General Assembly,\n\n Proclaims this Universal Declaration of Human Rights as a common standard of achievement for all peoples and all nations, to the end that every individual and every organ of society, keeping this Declaration constantly in mind, shall strive by teaching and education to promote respect for these rights and freedoms and by progressive measures, national and international, to secure their universal and effective recognition and observance, both among the peoples of Member States themselves and among the peoples of territories under their jurisdiction.\n '

const astmMessage = 'ASTM International, founded as the American Society for Testing and Materials, is a nonprofit organization that develops and publishes approximately 12,000 technical standards, covering the procedures for testing and classification of materials of every sort. Headquartered in West Conshohocken, United States, ASTM standards are used worldwide, with its membership consisting of over 30,000 members representing 135 countries. ASTM also serves as the administrator for the U.S. TAGs (United States Technical Advisory Group) to an enormous amount of ISO/TCs (International Organization for Standardization/Technical Committee) and to their subcommittees.'; // 完整的 ASTM 訊息
//const msgs = splitMessage(Buffer.from(astmMessage), 19);


let msgs = [];
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askForAdContent() {
    console.log('Code rate:', reedK/reedN);
    rl.question('請輸入廣告內容: (press 1 or 2 to transmit default messages.)', (answer) => {
        if (answer == '1'){
	    msgs = interleavedEncode(Buffer.from(astmMessage), blockSize, reedK, reedN);
	    console.log(msgs);
	    //msgs = splitMessage(Buffer.from(astmMessage), reedK);
	}
	else if (answer == '2'){
	    msgs = interleavedEncode(Buffer.from(humanRightDeclaration), blockSize, reedK, reedN);
	    //msgs = splitMessage(Buffer.from(humanRightDeclaration), reedK);
	}
	else if (answer == 'q'){
	    console.log('程式結束');
	    bleno.stopAdvertising();
	    rl.close();
	    process.exit(0);
	}
	else{
	    msgs = interleavedEncode(Buffer.from(answer), blockSize, reedK, reedN);
	    //msgs = splitMessage(Buffer.from(answer), reedK);
	}
	msgIndex = 0;
	startNextAdvertising();
    });
}


let msgIndex = 0; 

function startNextAdvertising() {
    if (msgIndex >= msgs.length) {
	setTimeout(() => {
	    bleno.stopAdvertising();
	}, 1000);
	//setTimeout(bleno.stopAdvertising(), 1000);
	askForAdContent();
	return;
    }
    console.log('msgIndex: ' + msgIndex);
    if (msgIndex < msgs.length) {
        if (msgIndex == msgs.length - 1) {
	    console.log(Buffer.concat([basicInfo, Buffer.from([toHexString(255)]), Buffer.from(msgs[msgIndex])]));
	    bleno.startAdvertisingWithEIRData(Buffer.concat([
	        basicInfo, 
	        Buffer.from([toHexString(255)]), 
	        Buffer.from(msgs[msgIndex])
	    ]));
	    setTimeout(() => {
		bleno.stopAdvertising();
	    }, 1000);
	    //setTimeout(bleno.stopAdvertising(), 1000);
	    askForAdContent();
	    return;
        }
        else{
	    if (msgs.length == 1){
	        console.log(Buffer.concat([basicInfo, Buffer.from([toHexString(255)]), Buffer.from(msgs[msgIndex])]));
	        bleno.startAdvertisingWithEIRData(Buffer.concat([
		    basicInfo, 
		    Buffer.from([toHexString(255)]), 
		    Buffer.from(msgs[msgIndex])
	        ]));
		return;
	    }
	    console.log(Buffer.concat([basicInfo, Buffer.from([toHexString(msgIndex)]), Buffer.from(msgs[msgIndex])]));
    	    bleno.startAdvertisingWithEIRData(Buffer.concat([
                basicInfo, 
                Buffer.from([toHexString(msgIndex)]), 
                Buffer.from(msgs[msgIndex])
    	    ]));
    	}
        setTimeout(startNextAdvertising, 500); 	
    	msgIndex++;
    }
    else{
	setTimeout(() => {
	    bleno.stopAdvertising();
	}, 1000);

	//setTimeout(bleno.stopAdvertising(),1000);
	askForAdContent();
    }
}

bleno.on('stateChange', (state) => {
    if (state === 'poweredOn') {
        askForAdContent();
    } else {
        bleno.stopAdvertising();
    }
});

process.on('SIGINT', () => {
    bleno.stopAdvertising();
    rl.close();
    process.exit(0);
});

