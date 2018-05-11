var mqtt = require('mqtt');
//for independent container
const broker_url = 'mqtt://ins-broker'
//for pod
//const broker_url = 'mqtt://localhost'
module.exports = {
    start: function(conn,disconn,message){
        let client = mqtt.connect(
            broker_url, 
            options = {
                port: 1883,
                host: broker_url,
                clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
                username: 'pc-jos',
                password: '1234qwer',
                keepalive: 60,
                reconnectPeriod: 1000,
                protocolId: 'MQIsdp',
                protocolVersion: 3,
                clean: true,
                encoding: 'utf8'
        });
        client.on('connect', () => {
                conn()
                // When connected
                console.log('MQTT>>:: connected');
                // subscribe to a topic
                client.subscribe('/+/+/+/+/+/+', () => {
                    // when a message arrives, do something with it
                    client.on('message', message);
                } );
                // publish a message to a topic
                client.publish(
                '/topvme/server/backend/all/event/0', 
                'backend connected', 
                ()=> console.log("MQTT>>:: backend online message is published"));
            } 
        )
        client.on('disconnect',disconn) // does this event even exists?
    }
}


