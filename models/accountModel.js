const mongoose = require('mongoose')

var Schema = mongoose.Schema;

// create a schema
var accountSchema = new Schema({
    userName:String,
    password:String,
    firstName:String,
    lastName:String,
    email:String,
    sp:Array,
    group:Array,
    activated:Number,
    activity:Array
}, {collection:"accountList"});

module.exports = mongoose.model('account', accountSchema);