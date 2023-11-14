const fs=require("fs");
const express = require('express');
const app = express();
const LocalStrategy = require('passport-local').Strategy;
const passport = require('passport');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
require('./servidor/passport-setup.js');
const modelo = require("./servidor/modelo.js");
const PORT = process.env.PORT || 3000;
const haIniciado=function(request,response,next){
    if (request.user){
        next();
    }
    else{
        response.redirect("/")
    }
}

app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + "/"));
app.use(cookieSession({
    name: 'Sistema',
    keys:['key1','key2']
}));
app.use(passport.initialize());
app.use(passport.session());
app.get("/auth/google",passport.authenticate('google', { scope: ['profile','email'] }));
app.get("/auth/github",passport.authenticate('github', { scope: ["user:email"] }));

let sistema = new modelo.Sistema();

passport.use(new
    LocalStrategy({usernameField:"email",passwordField:"password"},
    function(email,password,done){
        sistema.loginUsuario({"email":email,"password":password},function(user){
            return done(null,user);
        })
    }
));

app.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/fallo' }),
    function(req, res) {
        res.redirect('/good');
});

app.get("/good", function (req, res) {
    switch (req.user.provider) {
        case "google":
            let email = req.user.emails[0].value;
            sistema.usuarioOAuth({ email: email }, function (obj) {
            res.cookie("email", obj.email);
            res.redirect("/");
            });
            break;
        case "github":
            console.log(req.user);
            let email2 = req.user.username;
            sistema.usuarioOAuth({ email: email2 }, function (obj) {
            res.cookie("email", obj.email);
            res.redirect("/");
            });
            break;
        case "google-one-tap":
            let email3 = req.user.email;
            sistema.usuarioOAuth({ email: email3 }, function (obj) {
            res.cookie("email", obj.email);
            res.redirect("/");
            });
            break;
        default:
            res.redirect("/");
            break;
    }
  });

app.get('/fallo', function(request, response){
    response.send("Fallo en la autenticación");
});

app.get("/", function(request,response){
    var contenido=fs.readFileSync(__dirname+"/cliente/index.html");
    response.setHeader("Content-type","text/html");
    response.send(contenido);
});

app.get("/", function(request,response){
    var contenido=fs.readFileSync(__dirname+"/cliente/eliminarUsuario.html");
    response.setHeader("Content-type","text/html");
    response.send(contenido);
});

app.get("/agregarUsuario/:email", haIniciado, function(request,response){
    let email=request.params.email;
    let res=sistema.agregarUsuario(email);
    response.send(res);
});

app.get("/obtenerUsuarios", haIniciado, function(request,response){
    let res=sistema.obtenerUsuarios();
    response.send(res);
});

app.get("/eliminarUsuario/:email", haIniciado, function(request,response){
    let email=request.params.email;
    let res=sistema.eliminarUsuario(email);
    response.send(res);
});

app.get("/usuarioActivo/:email", haIniciado, function(request,response){
    let email = request.params.email;
    let res = sistema.usuarioActivo(email);
    response.send(res);
});

app.get("/numeroUsuarios", haIniciado, function(request,response){
    let res = sistema.numeroUsuarios();
    response.send(res);
});

app.post('/enviarJwt', function (request, response) {
    let jwt = request.body.jwt;
    let user = JSON.parse(atob(jwt.split(".")[1]));
    let email = user.email;
    sistema.usuarioGoogle({'email':email}, function(usr){
        response.send({'email':usr.email});
    });
});

app.post('/registrarUsuario', function (request, response) {
    sistema.registrarUsuario(request.body, function(res){
        response.send({'email': res.email});
    });
});

app.post('/loginUsuario',passport.authenticate("local",{failureRedirect:"/fallo",successRedirect: "/ok"}));

app.get("/ok",function(request,response){
    response.send({email:request.user.email})
});

app.get("/confirmarUsuario/:email/:key",function(request,response){
    let email=request.params.email;
    let key=request.params.key;
    sistema.confirmarUsuario({"email":email,"key":key},function(usr){
        if (usr.email!=-1){
            response.cookie('email',usr.email);
        }
        response.redirect('/');
    });
});

app.get("/cerrarSesion",haIniciado,function(request,response){
    let email=request.user.email;
    request.logout();
    response.redirect("/");
    if (email){
        sistema.eliminarUsuario(email);
    }
});

app.post('/oneTap/callback',
    passport.authenticate('google-one-tap', { failureRedirect: '/fallo' }),
    function(req, res) {
        res.redirect('/good');
});

app.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/fallo" }),
    function (req, res) {
      res.redirect("/good");
    }
  );

app.listen(PORT, () => {
    console.log(`App está escuchando en el puerto ${PORT}`);
    console.log('Ctrl+C para salir');
});