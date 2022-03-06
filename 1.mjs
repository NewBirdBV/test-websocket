/**
 * 鉴权，心跳机制，重连方案等。
 */

import { WebSocketServer } from 'ws';
import url from 'url';
import http from 'http';

import fs from 'fs';


const index = fs.readFileSync('./index.html');


const TicketsPool = {};


const s = http.createServer((req, res) => {
    const b = []

    req.on('data', chunk => {
        b.push(chunk);
    });

    req.on('end', () => {
        console.log(Buffer.concat(b).toString('utf-8'))
    });

    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(index);
}).listen(8080);


const wss = new WebSocketServer({ server: s });


wss.on('connection', async(ws, req) => {
    const ticket = issueTicket(req);
    ws.send(
        stringify({
            token: ticket.token
        })
    );

    ws.on('message', (message) => {
        const parsedMsg = JSON.parse(message);
        console.log(parsedMsg);

        if (!checkTicket(req, parsedMsg)) {
            terminate(ws)
        } else {
            if (parsedMsg.msg == 'ping') {
                ws.send(
                    stringify({
                        msg: 'pong'
                    })
                );
            } else {
                ws.send(
                    stringify({
                        msg: 'greeting'
                    })
                );
            }
        }
    })
})

function issueTicket(req) {
    const uniqueId = req.connection.remoteAddress;

    const ticket = new Ticket(uniqueId);
    TicketsPool[uniqueId] = ticket;
    return ticket;
}

function checkTicket(req, message) {
    const uniqueId = req.connection.remoteAddress;
    const record = TicketsPool[uniqueId];
    const token = message.token;
    return record
        && record.expireTime
        && record.token
        && record.token === token
        && record.expireTime >= Date.now()
}

function Ticket(peerUniqueId) {
    const salt = 'dxf';
    this.peerUniqueId = peerUniqueId;
    this.expireTime = Date.now() + 20*1000;
    this.token = `${salt}/${peerUniqueId}/${Date.now()}`;
}


function stringify(payload) {
    return JSON.stringify(payload);
}

function terminate(ws) {
    ws.send(
        stringify({
            msg: 'BYE!'
        })
    );
    ws.close();
}

