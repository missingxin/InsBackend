const mongoose = require('mongoose')

var Schema = mongoose.Schema;

// create a schema
var wawaGSchema = new Schema({
    uid:String,
    time:Number,
    sp:String,
    device:String,
    sid:String,
    rid:String,
    type:String,
    uptime:Number,
    raw:String,
}, {collection:"WawaGList"});

module.exports = mongoose.model('wawaG', wawaGSchema);