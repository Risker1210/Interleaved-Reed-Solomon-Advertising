const noble = require('noble');
const rs = require('./reedsolomon.js');

serviceUUIDs = ['7777', 'fffa'];

function RS(messageLength, eccLength) {
    let dataLength = messageLength - eccLength;
    let encoder = new rs.ReedSolomonEncoder(rs.GenericGF.AZTEC_DATA_8());
    let decoder = new rs.ReedSolomonDecoder(rs.GenericGF.AZTEC_DATA_8());
    return {
            dataLength: dataLength,
            messageLength: messageLength,
            eccLength: eccLength,
            encode: function(data) {
                    encoder.encode(data, eccLength);
            },
            decode: function(data) {
                    decoder.decode(data, eccLength);
            }
    };
}

function fromHexString(hexString) {
  return parseInt(hexString.replace('0x', ''), 16);
}
function deinterleaver(interleavedBuffers, blockSize) {
    const numMessages = interleavedBuffers.length;
    const totalLength = interleavedBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const messageLength = Math.floor(totalLength / numMessages);
    const originalMessages = Array.from({ length: numMessages }, () => Buffer.alloc(messageLength));

    for (let i = 0; i < totalLength; i++) {
        const msgIndex = Math.floor(i / messageLength);
        const byteIndex = i % messageLength;
        const interleavedIndex = (byteIndex * numMessages) + msgIndex;

        let bufferIndex = 0;
        let bufferOffset = interleavedIndex;
        while (bufferOffset >= interleavedBuffers[bufferIndex].length) {
            bufferOffset -= interleavedBuffers[bufferIndex].length;
            bufferIndex++;
        }

        originalMessages[msgIndex][byteIndex] = interleavedBuffers[bufferIndex][bufferOffset];
    }

    return originalMessages;
}

function deinterleaverTest(interleavedBuffers, blockSize) {
    const numMessages = interleavedBuffers.length;
    const messageLength = interleavedBuffers[0].length;
    const originalMessages = [];

    for (let i = 0; i < numMessages; i++) {
        originalMessages.push(Buffer.alloc(messageLength));
    }

    for (let i = 0; i < messageLength; i++) {
        for (let j = 0; j < numMessages; j++) {
            const srcIndex = (i * numMessages + j) % (numMessages * messageLength);
            const srcBufferIndex = Math.floor((i * numMessages + j) / messageLength);
            const destIndex = i;

            originalMessages[j][destIndex] = interleavedBuffers[srcBufferIndex][srcIndex % messageLength];
        }
    }

    return originalMessages;
}
function reedSolomonDecoder(messageBuffers, n = reedN, k = reedK) {
    const rsRecoder = RS(n, n - k);
    const decoder = new Uint8Array(rsRecoder.messageLength);
    messageBuffers.copy(decoder, 0);
    rsRecoder.decode(decoder);
    //console.log('message', messageBuffers);
    //console.log('decoder', decoder);
    return decoder;
}

function deinterleaveAndDecode(interleavedBuffers, bSize = blockSize) {
    console.log('interleavedBuffers', interleavedBuffers);
    const originalMessages = deinterleaver(interleavedBuffers, bSize);
    console.log('originalMessages', originalMessages);
    let decodedMessages = [];
    for (let i = 0; i < originalMessages.length; i++) {
	decodedMessages = Buffer.concat([Buffer.from(decodedMessages), reedSolomonDecoder(originalMessages[i], reedN, reedK).slice(0, reedK)]);
	//decodedMessages.push(reedSolomonDecoder(originalMessages[i], reedN, reedK));
    }
    return decodedMessages;
}

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning(serviceUUIDs, true);
  } else {
    noble.stopScanning();
  }
});

noble.on('scanStart', function() {
  console.log('Scanning started.');
});

let reedN = 25;
let reedK = 19;
let blockSize = 25;
console.log('code rate:', reedK/reedN);

messageTemp =[];
rsTemp = [];
decodedMessages = [];
//messageIndex = 0;
messageFlag = 0;
endFlag = false;
finalMessage = [];


noble.on('discover', function(peripheral) {
    const advertisement = peripheral.advertisement;
    const serviceData = advertisement.serviceData;
    if (serviceData && serviceData.length > 0) {
	if (serviceData[0].data[1] == 255) {
	    if (endFlag == false) {
	        rsTemp = serviceData[0].data.slice(2); 
	        console.log(serviceData[0].data);
	    	messageTemp.push(Buffer.from(rsTemp));
	        endFlag = true;
		decodedMessages = deinterleaveAndDecode(messageTemp, blockSize);
		console.log('decodedMessages', decodedMessages);
	        console.log('Received Data Length:\n',decodedMessages.length);
		console.log('Received Data:\n',decodedMessages.toString('utf8'));
	        messageFlag = 0; // reset messageFlag
		finalMessage = rsTemp;
		//finalMessage = rsTemp.slice(reedN-reedK);
	        messageTemp = [];
	    }
	    else if (endFlag == true) {
		if (serviceData[0].data.slice(2).equals(finalMessage)){ 
	            return;
	    	}
		else {
		    endFlag = true;
		    rsTemp = serviceData[0].data.slice(2);
		    console.log(serviceData[0].data);
	    	    //messageTemp.push(Buffer.from(rsTemp));
		    decodedMessages = Buffer.from(reedSolomonDecoder(rsTemp, reedN, reedK).slice(0, reedK));
		    console.log('Service Data Length:\n',decodedMessages.length);
		    console.log('Service Data:\n',decodedMessages.toString('utf8'));
		    messageFlag = 0; // reset messageFlag
		    finalMessage = rsTemp;
		    messageTemp = [];
		}
	    }
	}
	else{
	    if (serviceData[0].data[1] == messageFlag-1) {
		//Fliter out the repeated message
		return;
	    }
	    while (serviceData[0].data[1] > messageFlag) {
		//Missing message
		let emptyBuffer = Buffer.alloc(serviceData[0].data.length - 2, 0);
    		messageTemp.push(emptyBuffer);
		messageFlag = messageFlag + 1;
		//return;
	    }
	    rsTemp = serviceData[0].data.slice(2);
	    console.log(serviceData[0].data);
	    messageTemp.push(Buffer.from(rsTemp));
	    messageFlag = messageFlag + 1;
	    endFlag = false;
	}

    }
});

