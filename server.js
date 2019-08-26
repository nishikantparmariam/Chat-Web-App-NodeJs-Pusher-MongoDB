//Dependencies
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var multer = require('multer');
var db = require('./db');
var upload = multer(); 
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt');
var Pusher = require('pusher');
var moment = require('moment');
var htmlToText = require('html-to-text');
var Regex = require("regex");
var pusher = new Pusher({
  appId: '',
  key: '',
  secret: '',
  cluster: '',
  encrypted: true
});
const port = process.env.PORT || 3000;

const points_to_start_new_chat = 5;
//Views 
app.set('view engine', 'ejs');
app.set('views','./views');
//Use
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(upload.array());
app.use(cookieParser());
app.use(session({
    secret: "This is my secret",
    resave: true,
    saveUninitialized: true
}));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));
app.use('/img', express.static('img'));


//routes
app.get('/',(request,response)=>{
    response.redirect('/home');
});

app.get('/home',(request,response)=>{
    if(request.session.user){
        db.getDB().collection("users").findOne({_id:db.getPrimaryKey(request.session.user.user_id)}, (err,result)=>{
                
                request.session.user  = {
                    "username":result.username,
                    "fullname":result.fullname,            
                    "points":result.points,    
                    "chats":result.chats, 
                    "online":result.online,   
                    "user_id":result._id              
                };
                response.render('home',{user:request.session.user});
        });
        
    } else {
        response.redirect('/login');
    }
});

app.get('/login',(request,response)=>{
    if(request.session.user){
        response.redirect('/home');
    } else {
        var success=[];
        if (request.query.loggedout ==="success"){
            success.push({"message":"Logged out successfully"});
        };        
        response.render('login',{success:success});
    }
});

app.get('/signup',(request,response)=>{
    if(request.session.user){
        response.redirect('/home');
    } else {
        response.render('signup', {data:{"username":"","fullname":"","password":"","password2":""}});
    }
});

app.get('/logout',(request,response)=>{
    if(request.session.user){
        request.session.destroy(function(){            
            response.redirect('/login?loggedout=success');
         });        
    } else {
        response.redirect('/login');
    }
});



//db connection
db.connect((err)=>{
    if(err){
        console.log("Could not connect to db");
        console.log(err);
        process.exit(1);
    } else {
        app.listen(port,()=>{
            console.log("Connect to db");
            console.log("Listening to "+port);
        });
                
    }
});


//SignUp Requests
app.post('/signup',(request,response)=>{
    var formData = request.body;
    var fullname = formData.fullname;
    var username = formData.username;
    var password = formData.password;
    var password2 = formData.password2;
    var errors=[];

    //Checking all are filled
    if((fullname===""||fullname==null)||(username===""||username==null)||(password===""||password==null)||(password2===""||password2==null)){
        errors.push({
            "message":"Please fill all the fields"
        });
    }

    //Restrictions on password
    if(password.length<6){
        errors.push({
            "message":"Minimum 6 characters password needed"
        });
    }

    //Match pasword
    if(password!=password2){
        errors.push({
            "message":"Passwords didn't match"
        });
    }
    

    //Proceed if no error
    if(errors.length===0){

        var userData = {
            "fullname":fullname,
            "username":username,
            "password":password,
            "points":0,
            "online":false,
            "chats":[]
        }

        //finding if user already exists with given username
        db.getDB().collection("users").findOne({"username":username},(err,result)=>{
            if(err){
                console.log(err);
                errors.push({"message":"Some error occured!"});
                response.render('signup',{errors:errors, data:formData});
            } else {
                if(result){
                    errors.push({"message":"Please use another username"});
                    response.render('signup',{errors:errors, data:formData});
                } else {

                    //Register new user by hashing password
                    bcrypt.hash(userData.password, 10, function(err, hash) {
                        if(err){
                            console.log(err);
                            errors.push({"message":"Some error occured!"});
                            response.render('signup',{errors:errors, data:formData});
                        } else {
                            userData.password=hash;                                                          
                            db.getDB().collection("users").insertOne(userData,(err,result)=>{
                                if(err){
                                    console.log(err);
                                    errors.push({"message":"Some error occured!"});
                                    response.render('signup',{errors:errors, data:formData});
                                } else {   
                                    var success = [];                         
                                    success.push({"message":"User registered successfully! Please login"});
                                    response.render('signup',{errors:errors,success:success, data:{"username":"","fullname":"","password":"","password2":""}});
                                }
                            });
                        }
                    });
                    
                }               
                
            }
        });        
    } else {
        response.render('signup',{errors:errors, data:formData});
    }
});


//Login Requests
app.post('/login',(request,response)=>{
    var formData = request.body;
    var username = formData.username;
    var password = formData.password;    
    var errors=[];

    //Checking all are filled
    if((username===""||username==null)||(password===""||password==null)){
        errors.push({
            "message":"Please fill all the fields"
        });
    }

    //Proceed if no error
    if(errors.length===0){
    

        //finding if user exists with given username
        db.getDB().collection("users").findOne({"username":username},(err,result)=>{
            if(err){
                console.log(err);
                errors.push({"message":"Some error occured!"});
                response.render('login',{errors:errors});
            } else {

                if(result){
                    
                    bcrypt.compare(password, result.password, function(err, res) {
                        if(err){
                            console.log(err);
                            errors.push({"message":"Some error occured!"});
                            response.render('login',{errors:errors});
                        } else {
                            if(res===true){                                
                                var user = {
                                    "username":result.username,
                                    "fullname":result.fullname,            
                                    "points":result.points,    
                                    "chats":result.chats, 
                                    "online":result.online,   
                                    "user_id":result._id              
                                };
                                //console.log(user);
                                request.session.user = user;
                                response.redirect('/home');
                            } else {
                                errors.push({"message":"Wrong password"});
                                response.render('login',{errors:errors});
                            }
                        }
                    });
                } else {
                    errors.push({"message":"Wrong username"});
                    response.render('login',{errors:errors, data:formData});                                        
                }               
                
            }
        });        
    } else {
        response.render('login',{errors:errors});
    }
});


//OPTIONAL CODE
// (Above code would check if user with username is existing before sign up)
//this is just for checking while typing
app.get('/checkforuser/:username',(req,res)=>{
    console.log(req.params.username);
    if(req.params.username){
        db.getDB().collection("users").findOne({"username":req.params.username},(err,result)=>{
            if(err){
                console.log(err);
                errors.push({"message":"Some error occured!"});
                response.render('signup',{errors:errors, data:formData});
            } else {
                if(result){
                    //user found
                    var toSend = {
                        "error":false,
                        "found":true
                    };
                    res.json(toSend);                    
                } else {                    
                    var toSend = {
                        "error":false,
                        "found":false
                    };
                    res.json(toSend);
                }               
                
            }
        });

    } else {
        res.json({"error":true});
    }
});
//OPTIONAL ENDS

app.get('/searchusers/:query/:username',(req,res)=>{
    if(req.session.user){
        this_username = req.params.username;
        this_query = req.params.query;
        if(req.session.user.username===this_username){            
            db.getDB().collection("users").find({ "fullname": { $regex: '.*'+this_query+'.*' ,  '$options' : 'i'}, "username":{ $ne: req.session.user.username}}).toArray((err,docs)=>{
                if(err){
                    res.json({"error":true, "msg":"Please try again"});
                } else {
                    res.json(docs);
                }
            });

        } else {
            res.json({"error":true, "msg":"Please login with your account"});    
        }
    } else {
        res.json({"error":true,"msg":"Please login"});
    }
});


app.post('/addnewchat',(req,res)=>{
    if(req.session.user){
        uid2 = req.body.uid2;        
        if(uid2){            
            
            db.getDB().collection("users").findOne({_id:db.getPrimaryKey(uid2)},(err,result)=>{
                    if(err){
                        res.json({"error":true});
                    } else {
                        if(result){     
                                                   
                            var common = req.session.user.chats.filter(n => result.chats.some(n2 => n == n2));
                            if(common.length===0){
                                var newchatid = req.session.user.username+""+result.username;
                                var newchatu1 = req.session.user.chats;
                                var newchatu2 = result.chats;
                                var points_1=req.session.user.points+points_to_start_new_chat;
                                var points_2=result.points+points_to_start_new_chat;                                
                                req.session.user.points=points_1;
                                newchatu1.push(newchatid);
                                newchatu2.push(newchatid);
                                req.session.user.chats=newchatu1;
                                console.log(req.session.user.chats);
                                db.getDB().collection("users").findOneAndUpdate({_id:db.getPrimaryKey(uid2)}, {$set:{chats:newchatu2,points:points_2}},{returnOriginal:false},(err,result)=>{
                                    if(err){
                                        console.log(err);
                                    }
                                });
                                db.getDB().collection("users").findOneAndUpdate({_id:db.getPrimaryKey(req.session.user.user_id)}, {$set:{chats:newchatu1, points:points_1}},{returnOriginal:false},(err,result)=>{
                                    if(err){
                                        console.log(err);
                                    }
                                });
                                var chat_data = {
                                    "chat_id":newchatid,
                                    "for":[uid2,req.session.user.user_id],
                                    "last_message":"New chat established",
                                    "chat_name":{
                                        [result.username]:req.session.user.fullname,
                                        [req.session.user.username]:result.fullname
                                    },
                                    "last_message_by":null,
                                    "last_message_seenby":[],
                                    "time":moment().format('MMMM Do YYYY, h:mm a'),
                                    "new_chat":true
                                }
                                
                                db.getDB().collection("chats").insertOne(chat_data,(err,result)=>{
                                    if(err){
                                        console.log(err);
                                    } else {
                                        //console.log(result);                                        
                                    }
                                });

                                pusher.trigger('chat-changes', 'add', {
                                    "chat_data":chat_data
                                });

                                pusher.trigger('points-changes','add',{
                                    "for":[req.session.user.user_id, uid2],
                                    "to_add":points_to_start_new_chat
                                });

                                res.json({"error":false});

                            } else {
                                res.json({"error":true});
                            }                            
                            
                            
                        } else {
                            res.json({"error":true}); 
                        }
                    }
            });

        } else {
            res.json({"error":true});    
        }
    } else {
        res.json({"error":true});
    }
});

app.get('/getchatdetails',(request,response)=>{
    if(request.session.user){


        db.getDB().collection("chats").find({for: { $all: [''+request.session.user.user_id+''] }}).toArray((err,docs)=>{
                if(err){
                    console.log(err);
                    response.json({});
                } else {
                    response.json(docs);
                }
        })
    }
});

app.get('/getmessages/:chat_id',(request,response)=>{
        db.getDB().collection("users").findOne({"_id":db.getPrimaryKey(request.session.user.user_id)},(err,user)=>{
                if(err){
                    console.log(err);
                } else {
                        
                        request.session.user.chats=user.chats;
                        var chat_id = request.params.chat_id;
                        if(request.session.user){
                                if(chat_id){
                                    if(chat_id!=''){
                                        if(request.session.user.chats.includes(chat_id)){
                                                db.getDB().collection(chat_id).find().toArray((err,docs)=>{
                                                    if(err){
                                                        response.json({});
                                                    } else {


                                                        db.getDB().collection("chats").findOne({"chat_id":chat_id, "new_chat":false}, (err,result)=>{
                                                            if(err){
                                                                console.log(err);
                                                            }
                                                            var data = {
                                                                "docs":docs,
                                                                "lastbymeseen":false
                                                            };
                                                            if(result){
                                                                var last_message_seenby = result.last_message_seenby;
                                                                var last_message_by =     result.last_message_by;
                                                                /*if(!last_message_seenby.includes(request.session.user.user_id)){
                                                                    last_message_seenby.push(request.session.user.user_id);

                                                                    db.getDB().collection("chats").findOneAndUpdate({"chat_id":chat_id}, {$set:{"last_message_seenby":last_message_seenby}},{returnOriginal:false},(err,result)=>{
                                                                        if(err){
                                                                            console.log(err);
                                                                        }
                                                                    });
                                                                    pusher.trigger('message-changes', 'changes', {                
                                                                        "chat_id":chat_id,
                                                                        "lastseen":true
                                                                    });
                                                                }    
                                                                */  
                                                               if(last_message_by===request.session.user.user_id){
                                                                        if(last_message_seenby.length>0){
                                                                            var data = {
                                                                                "docs":docs,
                                                                                "lastbymeseen":true
                                                                            };
                                                                        } 

                                                               }   else {
                                                                    if(!last_message_seenby.includes(request.session.user.user_id)){
                                                                        last_message_seenby.push(request.session.user.user_id);

                                                                        db.getDB().collection("chats").findOneAndUpdate({"chat_id":chat_id}, {$set:{"last_message_seenby":last_message_seenby}},{returnOriginal:false},(err,result)=>{
                                                                            if(err){
                                                                                console.log(err);
                                                                            }
                                                                        });
                                                                        pusher.trigger('message-changes', 'changes', {                
                                                                            "chat_id":chat_id,
                                                                            "lastseen":true
                                                                        });                                                                        
                                                                    }
                                                               }
                                                               
                                                               response.json(data);

                                                            } else {
                                                                response.json(data);
                                                                
                                                            }
                                                        });
                                                        /*db.getDB().collection("chats").findOne({"chat_id":chat_id, "new_chat":false,"last_message_by":{$ne:request.session.user.user_id }}, (err,result)=>{
                                                            if(err){
                                                                console.log(err);
                                                            }
                                                            if(result){
                                                                var last_message_seenby = result.last_message_seenby;
                                                                if(!last_message_seenby.includes(request.session.user.user_id)){
                                                                    last_message_seenby.push(request.session.user.user_id);

                                                                    db.getDB().collection("chats").findOneAndUpdate({"chat_id":chat_id}, {$set:{"last_message_seenby":last_message_seenby}},{returnOriginal:false},(err,result)=>{
                                                                        if(err){
                                                                            console.log(err);
                                                                        }
                                                                    });
                                                                    pusher.trigger('message-changes', 'changes', {                
                                                                        "chat_id":chat_id,
                                                                        "lastseen":true
                                                                    });
                                                                }                                                                
                                                            }
                                                        });*/
                                                        
                                                        
                                                        
                                                    }                                    
                                                });
                                        }
                                    }
                                }                
                        }
                }
        });        
});

app.post('/addnewmsg',(request, response)=>{
        if(request.session.user){
            var chat_id = request.body.chat_id;
            var msg = request.body.msg;
            msg = htmlToText.fromString(msg, {
                wordwrap: 130
            });
            
            if(request.session.user.chats.includes(chat_id)&&msg.trim()!=''){
                        var toInsert = {
                            "msg":msg,
                            "time":moment().format('MMMM Do YYYY, h:mm a')+"",
                            "by":request.session.user.user_id,                            
                        };

                    db.getDB().collection(chat_id).insertOne(toInsert,(err,result)=>{
                            if(err){
                                response.json({"error":true});
                            } else {

                                toInsert["seenby"]=[];

                                db.getDB().collection("chats").findOneAndUpdate({"chat_id":chat_id}, {$set:{"last_message":msg,"new_chat":false,"last_message_seenby":[],"last_message_by":request.session.user.user_id}},{returnOriginal:false},(err,result)=>{
                                    if(err){
                                        console.log(err);
                                    }
                                });

                                if(result.insertedCount===1){
                                    //Success;
                                    response.json({"error":false});
                                    pusher.trigger('message-changes', 'add', {
                                        "message_data":toInsert,
                                        "chat_id":chat_id
                                    });
                                }
                            }
                    })
            } else {
                response.json({"error":true});
            }
        }
});

app.get('/msgseen/:id',(request,response)=>{
    if(request.session.user){
        var chat_id = request.params.id;
        if(request.session.user.chats.includes(chat_id)){
            db.getDB().collection("chats").findOne({"chat_id":chat_id, "new_chat":false,"last_message_by":{$ne:request.session.user.user_id }}, (err,result)=>{
                if(err){
                    console.log(err);
                }
                if(result){
                    var last_message_seenby = result.last_message_seenby;
                    last_message_seenby.push(request.session.user.user_id);

                    db.getDB().collection("chats").findOneAndUpdate({"chat_id":chat_id}, {$set:{"last_message_seenby":last_message_seenby}},{returnOriginal:false},(err,result)=>{
                        if(err){
                            console.log(err);
                        } else {
                            
                        }
                    });
                }
            });
            response.json({});
            pusher.trigger('message-changes', 'changes', {                
                "chat_id":chat_id,
                "lastseen":true
            });

        }
    }
});

app.get("/getuserchats/:id", (request,response)=>{
    if(request.session.user){
        if(request.params.id){
            if(request.params.id.trim()!=''){
                db.getDB().collection("users").findOne({"_id":db.getPrimaryKey(request.params.id)},(err,result)=>{
                        if(err){
                            response.json({"error":true});  
                        } else {
                            if(result){
                                var common = request.session.user.chats.filter(n => result.chats.some(n2 => n == n2));
                                if(common.length>0){    
                                    response.json({"error":false, "chat_id":common[0], "personName2":result.fullname});
                                } else {
                                    response.json({"error":true});    
                                }   
                            } else {
                                response.json({"error":true});
                            }
                        }
                });
            }
        } else {
            response.json({"error":true});
        }
    } else {
        response.json({"error":true});
    }
});

app.get('*',(request,response)=>{
    response.render('404');
});
