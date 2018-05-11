const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const http = require('http')
const socketServer =require('socket.io')
const wawaGModel = require('./models/wawaGModel')
const accountModel = require('./models/accountModel')
const mqttcatcher = require('./models/mqttcatcher')
const app = express();
//for independent container
const mongodb_url = "mongodb://ins-mongo:27017/local"
//for pod
//const mongodb_url = "mongodb://localhost:27017/local"

const rc4 = require('./crypo.js')
var sha256 = require('js-sha256');
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())

// MONGOOSE CONNECT
// ===========================================================================
mongoose.connect(mongodb_url)

var db = mongoose.connection
db.on('error', ()=> {console.log( '---Gethyl FAILED to connect to mongoose')})
db.once('open', () => {
	console.log( 'SERV>>:: Gethyl connected to mongoose')
})

var serve = http.createServer(app);
var io = socketServer(serve);
serve.listen(3000,()=> {console.log("SERV>>:: Gethyl Express Server with Socket Running!!!")})

const expiredMs = 1800000
/*********************************************************** */
/* Socket logic starts here																   */
/*********************************************************** */
function generate_ms(){
	let d = new Date();
	return d.getTime();
}
let session = {};
/*
session = {
	token:{
		exp,
		usr,
		sp, #以後就不用一直查sp
	}
}
*/
let connections = [];
/*
connections = [
	connection = {
		filter,
		token,
		socket,
		sig,
	}
]
*/

function clearExpired(){
	let sesscnt_before = Object.keys(session).length
	let current_ms = generate_ms();
	for (let [token, sessData] of Object.entries(session)) {
		if (sessData.exp < current_ms){
			delete session[token]
		}
	}
	let sesscnt_after = Object.keys(session).length
	console.log("SERV>>:: sessions AFTER clearExpired() : "+sesscnt_before+" -> "+sesscnt_after)
}
function intersect(a, b) {
  var setA = new Set(a);
  var setB = new Set(b);
  var intersection = new Set([...setA].filter(x => setB.has(x)));
  return Array.from(intersection);
}
function clearUser(user){
	let sesscnt_before = Object.keys(session).length
	for (let [token, sessData] of Object.entries(session)) {
		if (sessData.usr == user){
			delete session[token]
		}
	}
	let sesscnt_after = Object.keys(session).length
	console.log("SERV>>:: session AFTER clearUser("+user+") : "+sesscnt_before+" -> "+sesscnt_after)
}

function validToken(token){
	clearExpired()
	let current_ms = generate_ms();
	if(session[token] && session[token].exp && session[token].usr && session[token].exp > current_ms){
		return 0;
	}
	return 1;
}



io.on('connection', function (socket) {
	console.log("SERV>>:: Connected to Socket!!"+ socket.id)
	let connection = {"socket":socket}
	connections.push(connection)
	socket.on('disconnect', () => {
		console.log('SERV>>:: Disconnected - '+ socket.id)
		delete connection
	}
	);
  function addUser(userName,password,firstName,lastName,email,group=[],sp=["topvme"],cb){
		var userItem = new accountModel({
			userName:userName,
			password:password,
			firstName:firstName,
			lastName:lastName,
			email:email,
			sp:sp,
			activated:1,
			group:group,
			activity:[]
		})
		userItem.save(cb)
	}
	///////// account init //////////
	accountModel.find(
		{},
		"_id userName firstName lastName email sp activated activity",
		(err,result) => {
			if (err){
				console.log("SERV>>:: WaWaG GET failed!!") 
			} else {
				if (result.length == 0){
					addUser("lance",sha256("1234"),"MJ","J","jmj@mail.com",["admin"],sp=["tv","SPlance"],(err,result)=> { if (err) { console.log("SERV>>:: admin init failed!! err = " +  err) } 
					else { console.log("SERV>>:: admin init finished!! result = " +  result) }
					});
					addUser("shane",sha256("1234"),"SS","Y","yss@mail.com",["admin"],sp=["tv","SPshane"],(err,result)=> { if (err) { console.log("SERV>>:: admin init failed!! err = " +  err) } 
					else { console.log("SERV>>:: admin init finished!! result = " +  result) }
					});
					addUser("joseph",sha256("1234"),"ZH","L","lzh@mail.com",["admin"],sp=["tv","SPjoseph"],(err,result)=> { if (err) { console.log("SERV>>:: admin init failed!! err = " +  err) } 
					else { console.log("SERV>>:: admin init finished!! result = " +  result) }
					});
				}
			}
		}
	)
/*
	socket.on('addWawaG',(addData)=>{
		console.log("SERV>>:: on addWawaG !!"+ socket.id)
		var wawaGItem = new wawaGModel({
			time:addData.time,
			sp:"topvme",
			device: addData.device,
			sid: addData.sid,
			rid: addData.rid,
			type: addData.type,
			uptime: 0,
			raw: addData.raw,
		})
		wawaGItem.save((err,result)=> {
			if (err) {
				//console.log("SERV>>:: WaWaG ADD NEW ITEM failed!! " + err)
			} else {
				addData._id = result._id
				socket.emit('WawaGAdded',addData)
			}
		})
	})
	*/
	socket.on('LOGIN_CHECK',(data)=>{ //檢查此token是否存在
		console.log("SERV>>:: LOGIN_CHECK in !!"+ socket.id)
		let current_ms = generate_ms()
		if (data && data.token && validToken(data.token) == 0) {
			connection.token = data.token;
			session[connection.token].exp = current_ms + expiredMs
			socket.emit('LOGIN_CHECK',{usr:session[data.token].usr, exp:current_ms + expiredMs})
		}else{
			connection.sig = current_ms.toString()
			//console.log('LOGIN_CHECK return sig: '+connection.sig)
			socket.emit('LOGIN_CHECK',{error:"error",sig:connection.sig})
		}
		console.log("SERV>>:: LOGIN_CHECK out!!"+ socket.id)
	})
	socket.on('LOGIN_SIG',(data)=>{
		console.log("SERV>>:: LOGIN_SIG in !!"+ socket.id)
		let current_ms = generate_ms()
		connection.sig = current_ms.toString()
		socket.emit('LOGIN_SIG',{sig:connection.sig})
		console.log("SERV>>:: LOGIN_SIG out!!"+ socket.id)
	})

	socket.on('LOGIN_REQUEST',(data)=>{
		console.log("SERV>>:: LOGIN_REQUEST in !!"+ socket.id)
		if(data.usr && data.pwd){
			if(connection.sig){
				let pwd_after_rc4_decode = rc4(connection.sig,data.pwd);
				//console.log("pwd_after_rc4_decode = ", pwd_after_rc4_decode)
				//console.log("connection.sig = ",connection.sig)
				accountModel.find(
					{userName:data.usr,password:pwd_after_rc4_decode},
					"userName firstName lastName email sp activated activity",
					(err,result) => {
						if (err){
							socket.emit('LOGIN_REQUEST',{error:"invalid, error:"+err})
						} else {
							if(result.length == 1){
								let expire = generate_ms()+expiredMs
								let token = "token"+generate_ms()
								session[token] = {exp:expire,usr:data.usr,sp:result[0]._doc.sp}
								connection.token = token

								console.log("SERV>>:: LOGIN_REQUEST : CURRENT sessions : "+JSON.stringify(session))
								socket.emit('LOGIN_REQUEST',{token:token,exp:expire,data:result[0]._doc})
							}else{
								socket.emit('LOGIN_REQUEST',{error:"invalid, error: wrong number"})
							}
						}
					}
				)
			}else{
				socket.emit('LOGIN_REQUEST',{error:"invalid sig"})
			}
		}else{
			socket.emit('LOGIN_REQUEST',{error:"invalid, missing usr or pwd"})
		}
		console.log("SERV>>:: LOGIN_REQUEST out!!"+ socket.id)
	})

	socket.on('LOGOUT_REQUEST',(data)=>{
		console.log("SERV>>:: LOGOUT_REQUEST in !!"+ socket.id)
		if (connection.token && validToken(connection.token) == 0) {
			if(data.all){
				clearUser(session[connection.token].usr)
			}else{
				delete session[connection.token]
			}
			delete connection.token
			socket.emit('LOGOUT_REQUEST',{result:"ack"})
			console.log("SERV>>:: LOGOUT_REQUEST : CURRENT sessions : "+JSON.stringify(session))
		}else{
			socket.emit('LOGOUT_REQUEST',{error:"error"})
		}
		console.log("SERV>>:: LOGOUT_REQUEST out!!"+ socket.id)
	})

	socket.on('DATA_FILTER',(data)=>{
		console.log("SERV>>:: DATA_FILTER in !!"+ socket.id)
		if (connection.token && validToken(connection.token) == 0) {
			let filter = {sp:session[connection.token].sp}
			session[connection.token].exp = generate_ms() + expiredMs
			if (data.filter){
				console.log("SERV>>:: DATA_FILTER : required filter : "+JSON.stringify(data.filter))
				if(data.filter.sp){
					filter.sp = intersect(data.filter.sp,session[connection.token].sp)
				}
				if(data.filter.dev){filter.device = data.filter.dev}
				if(data.filter.sid){filter.sid = data.filter.sid}
				if(data.filter.rid){filter.rid = data.filter.rid}
				if(data.filter.st && data.filter.en){
					filter.time = { $gt: data.filter.st, $lt: data.filter.en}
				}else if (data.filter.st){
					filter.time = { $gt: data.filter.st}
				}else if (data.filter.en){
					filter.time = { $lt: data.filter.en}
				}
			}
			console.log("SERV>>:: DATA_FILTER : Actual filter : "+JSON.stringify(filter))

			connection.filter = filter
			wawaGModel.find( filter,
				"_id time device sp sid rid type uptime raw",
				(err,result) => {
					if (err){
						let res = {error:"failed to get data, error:"+err}
						console.log("SERV>>:: DATA_FILTER: error, failed to get data!! "+ socket.id)
						socket.emit('DATA_FILTER', res)
					} else {
						let res = {data:result}
						console.log("SERV>>:: DATA_FILTER: got some results "+ socket.id)
						console.log("SERV>>:: DATA_FILTER: result.length=" + res.length)
						socket.emit('DATA_FILTER', res)
					}
				}
			)
		}else{
			let res = {error:"not authorized:"}
			console.log("SERV>>:: DATA_FILTER: error, NOT AUTHORIZED!! "+ socket.id)
			socket.emit('DATA_FILTER', res)
		}
		console.log("SERV>>:: DATA_FILTER out!!"+ socket.id)
	})
});

function incomingfilter(obj, filter){
	if(filter){


		if(filter.sp  && !( filter.sp == obj.sp   || filter.sp.includes (obj.sp ))){ return 2 }
		if(filter.device && !( filter.device == obj.device || filter.device.includes(obj.device))){ return 3 }
		if(filter.sid && !( filter.sid == obj.sid || filter.sid.includes(obj.sid))){ return 4 }
		if(filter.rid && !( filter.rid == obj.rid || filter.rid.includes(obj.rid))){ return 5 }
		if(filter.st  &&  filter.st< obj.time ){ return 6 }
		if(filter.en  &&  filter.en> obj.time ){ return 7 }
	}
	return 0
		
}

function broadcast(topic,payload){
  console.log("SERV>>:: Got mqtt message:, TOPIC = ",topic)
	console.log("SERV>>:: PAYLOAD = ",payload)
	var topicSplit = topic.split("/");
	let t = generate_ms()
	if(topicSplit.length == 7){
		let obj = {
			time:		t,
			sp:			topicSplit[1],
			device: topicSplit[2],
			sid: 		topicSplit[3],
			rid: 		topicSplit[4],
			type: 	topicSplit[5],
			uptime: topicSplit[6],
			raw: 		payload.toString('utf8')
		}
		var wawaGItem = new wawaGModel(obj)
		wawaGItem.save((err,result)=> {
			if (err) {
				console.log("SERV>>:: WaWaG ADD NEW ITEM failed!! ")
			} else {
				console.log("SERV>>:: WaWaG ADD NEW ITEM succeed!! ")
				console.log("SERV>>:: currently we have <<<"+connections.length+ ">>> connections")
				connections.forEach(function(conn){
					if (conn.token
						&& validToken(conn.token) == 0
						&& session[conn.token]
						&& session[conn.token].sp
						&& session[conn.token].sp.length>0
						&& session[conn.token].sp.includes(obj.sp)
					){
						console.log("SERV>>:: preserved filter : "+ JSON.stringify(conn.filter))
						console.log("SERV>>:: current object : "+ JSON.stringify(obj))
						let filterResult = incomingfilter(obj,conn.filter)
						if ( filterResult == 0){
							//可直接過去
							console.log('SERV>>:: pass the connection filter')
							conn.socket.emit('DATA_INCOMING',{data:obj})
						}else{
							//濾掉
							console.log("SERV>>:: ignored by connection filter, error code : "+ filterResult)
						}
					}
				});
				//io.emit('DATA_INCOMING',obj)
			}
		})
	}else{
		console.log("SERV>>:: wrong topic, ignore it")
	}
}


// ========= initiate the mqtt catcher =========
mqttcatcher.start(
  ()=> console.log("SERV>>:: got mqtt connected"),
	()=> console.log("SERV>>:: got mqtt dosconnected"),
	broadcast
)

