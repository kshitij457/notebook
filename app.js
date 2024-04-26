var express = require('express');
var passport = require("passport");
var jquery = require("jquery");
var bodyParser  = require("body-parser");
var mongoose = require("mongoose");
var methodOverride = require("method-override");
var LocalStrategy= require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var flash = require("connect-flash");

var app = express();

mongoose.connect('mongodb://localhost/notebook', {useNewUrlParser: true, useUnifiedTopology: true});

mongoose.set('useFindAndModify', false);

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));

var userSchema = new mongoose.Schema({
    username: String,
    password: String,
    followers: [],
    following: []
});

userSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User", userSchema);
//PASSPORT CONFIG
app.use(require('express-session')({
    secret: "I can do it!",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(flash());


app.use(function(req,res,next){   
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

var ObjectId = mongoose.Schema.Types;
var noteSchema = new mongoose.Schema({
    title: String,
    createdAt: {type: Date, default: Date.now},
    body: String,
    username: String,
    userId: String,
    likes: [],
    comments: [
        {
           type: mongoose.Schema.Types.ObjectId,
           ref: "Comment"
        }
     ]
});

var Note = mongoose.model("Note", noteSchema);

var comSchema = new mongoose.Schema({
    body: String,
    username: String,
    userId: String
});

var Com = mongoose.model("Com", comSchema);


var commentSchema = mongoose.Schema({
    text: String,
    author: {
            id:    {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                    },
            username: String
    }
});

var Comment = mongoose.model("Comment", commentSchema);

app.get("/", function(req,res){
    res.render("home.ejs");
});
//REGISTER RiOUTES
app.get("/register", function(req,res){
    res.render("register.ejs");
});
app.post("/register", function(req,res){
    User.register(new User({username: req.body.username}), req.body.password, function(err, user){
        if(err){
            req.flash("error", err.message);
            res.redirect("/register");
        }
        passport.authenticate("local")(req,res, function(){
            req.flash("success", "Sucessfully Signed up! Welcome to Notebook!");
            res.redirect("/dashboard");
        });    
    });
});
//LOGIN ROUTES
app.get("/login", function(req,res){
    res.render("login.ejs");
});
app.post("/login", passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true
}), function(req,res){
});
//LOGOUT ROUTES
app.get("/logout" ,function(req,res){
    req.logOut();
    req.flash("success", "Successfully logged out!");
    res.redirect("/");
}); 


isLoggedIn = function(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You don't have permission to do that!");
    res.redirect("/login");
}

app.get("/dashboard",isLoggedIn, function(req,res){
    Note.find({}).populate("comments").exec(function(err, foundNote){
        if(err){
            console.log("Some error occurred");
            console.log(err);
        }else {
            User.find({}, function(err, user){
                if(err){
                    console.log("Some error occurred");
                    console.log(err);
                }else {
                    Com.find({}, function(err, com){
                        if(err){
                            res.send("something went wrong!");
                        } else{
                            res.render("dashboard.ejs", {note:foundNote, user:user, com:com});
                        }
                    });
                }
            });
        }
    });
});

app.get("/new",isLoggedIn, function(req,res){
    User.find({}, function(err, user){
        if(err){
            console.log("Some error occurred");
            console.log(err);
        }else {
            res.render("new.ejs", {user: user});
        }
    });
});

app.get("/notes", isLoggedIn, function(req,res){
    Note.find({}).populate("comments").exec(function(err, foundNote){
        if(err){
            console.log("Some error occurred");
            console.log(err);
        }else {
            User.find({}, function(err, user){
                if(err){
                    console.log("Some error occurred");
                    console.log(err);
                }else {
                     res.render("yournotes.ejs", {note:foundNote, user:user}); 
                }
            });
        }
    });
});

app.get("/profile/:id", isLoggedIn, function(req,res){
    Note.find({}).populate("comments").exec(function(err, foundNote){
        if(err){
            console.log("Some error occurred");
            console.log(err);
        }else {
            User.findById(req.params.id, function(err, founduser){
                if(err){
                    console.log("Some error occurred");
                    console.log(err);
                }else {
                    User.find({}, function(err, user){
                        if(err){
                            console.log("Some error occurred");
                            console.log(err);
                        }else {
                            res.render("profile.ejs", {note:foundNote, founduser: founduser, user:user}); 
                        }
                    });
                }
            });
        }
    });
});

app.get("/notes/:id", isLoggedIn, function(req, res) {
    Note.findById(req.params.id).populate("comments").exec(function(err, note) {
        if(err) {
            console.log(err);
        } else {
            User.find({}, function(err, user){
                if(err){
                    res.send("something went wrong!");
                } else {
                    res.render("show.ejs", {note: note, user:user});
                }
            });
        }
    });
});

app.post("/notes",isLoggedIn, function(req,res){
    var title =  req.body.title;
    var body  =  req.body.body;
    var username  = req.user.username;
    var userId  = req.user._id;
    var note={title: title, body: body, username: username, userId:userId};
    Note.create(note, function(err, foundNote){
        if(err){
            console.log("Some error occurred");
            console.log(err);
        }else {
             res.redirect("/dashboard"); 
        }
    });
});


//likes
app.post('/notes/likes/:id',isLoggedIn,(req,res)=>{
    // find likes in mongo
    Note.findById(req.params.id, function(err, note){
        if(err) {
            console.log("error occured");
            res.send("Page not found!");
        } else {
            var isLiked = false;
            for(var i = 0; i< note.likes.length; i++) {
                var liker  = note.likes[i];
                if(liker._id.toString() == req.user._id.toString()){
                    isLiked = true;
                    break;
                }
            }
                if(isLiked == true){
                    // is liked then unlike i.e pull
                    Note.findByIdAndUpdate(req.params.id,{
                        $pull:{likes:req.user._id}
                    },{
                        new:true
                    }).exec((err,result)=>{
                        if(err) {
                            console.log("Error Occured");
                            res.send("Page not found");
                        }
                        else{
                            res.redirect('back');
                        }
                    })
                } else {
                    // is not liked so like for the first time i.e push
                    Note.findByIdAndUpdate(req.params.id,{
                        $push:{likes:req.user._id}
                    },{
                        new:true
                    }).exec((err,result)=>{
                        if(err) {
                            console.log("Error Occured");
                            res.send("Page not found");
                        }
                        else{
                            res.redirect('back');
                        }
                    })
                }
        }
    });
})

//comments
app.get("/notes/:id/comments/new",isLoggedIn, function(req,res){
    Note.findById(req.params.id, function(err, note){
        if(err){
            console.log(err);
        } else {
            User.find({}, function(err,user){
                if(err){
                    res.send("something went wrong!");
                } else {
                     res.render("new_comment.ejs", {note: note, user:user});
                }
            })
        }
    });
});
app.post("/notes/:id/comments",isLoggedIn, function(req,res){
    //find by id
    Note.findById(req.params.id, function(err, note){
           //create a new comment
           if(err) {
               console.log(err);
           } else {
               Comment.create(req.body.comment, function(err, comment){
                   // add to arr
                   if(err){
                       console.log(err);
                   }else {
                       comment.author.id = req.user._id;
                       comment.author.username = req.user.username;
                       comment.save();
                       note.comments.push(comment);
                       note.save();
                       res.redirect("/notes/" + note._id);
                   }
               });
           }
    });
});

// search function

app.post("/search",isLoggedIn, function(req,res){
    input = req.body.input;
    User.find({}, function(err, user){
     if(err){
         res.send("something went wrong!");
     } else {
         res.render("searchResults.ejs", {input:input, user:user});
     }
 });
});

//community

app.get("/community/new",isLoggedIn, function(req,res){
    User.find({}, function(err, user){
        if(err){
            res.send("something went wrong!");
        } else {
            res.render("community-new.ejs", {user:user});
        }
    });
});

app.post("/community",isLoggedIn, function(req,res){
    var body  =  req.body.body;
    var username  = req.user.username;
    var userId = req.user._id;
    var com={body: body, username: username, userId: userId};
    Com.create(com, function(err, com){
        if(err){
            console.log("Some error occurred");
            console.log(err);
        }else {
             res.redirect("/dashboard"); 
        }
    });
});

app.get("/compose",isLoggedIn, function(req,res){
    User.find({}, function(err, user){
     if(err){
         res.send("something went wrong!");
     } else {
         res.render("compose-choice.ejs", {user:user});
     }
 });
});

app.get("/community", function(req,res){
    User.find({}, function(err, user){
        if(err){
            res.send("something went wrong!");
        } else {
            Com.find({}, function(err, com){
                if(err){
                    res.send("something went wrong!");
                } else{
                    res.render("yourcommunity.ejs", {user:user, com:com});
                }
            });
        }
    });
});

//following logic

app.post("/follow/:id" , isLoggedIn,function(req,res){
User.findById(req.params.id, function(err, user){
        //create a new comment
        if(err) {
            console.log(err);
        } else {
            var isfollowed = false;
            for(var i = 0; i< user.followers.length; i++) {
                var follower  = user.followers[i];
                if(follower.toString() == req.user._id.toString()){
                    isfollowed = true;
                    break;
                }
            }          

            if(isfollowed == false){
                User.findByIdAndUpdate(req.params.id,{
                    $push:{followers:req.user._id}
                },{  new:true },(err,result)=>{
                    if(err){
                        res.send("something went wrong")
                    } else {
                        User.findByIdAndUpdate(req.user._id,{
                            $push:{following:req.params.id}
                        },{  new:true },(err,result)=>{
                            if(err){
                                res.send("something went wrong")
                            } else {
                                res.redirect("/profile/" + req.params.id);
                            }})
                    }})
            } else {
                User.findByIdAndUpdate(req.params.id,{
                    $pull:{followers:req.user._id}
                },{
                    new:true
                },(err,user)=>{
                    if(err){
                        res.send("something went wrong");
                    }
                  User.findByIdAndUpdate(req.user._id,{
                      $pull:{following:req.params.id}
                      
                  },{new:true}).select("-password").then(result=>{
                    res.redirect("/profile/" + req.params.id);
                  }).catch(err=>{
                    res.send("something went wrong");
                  })
                
                })
            }
        }
    });
});

app.listen(4000, function(req,res){
    console.log("Notebook server started.");
});