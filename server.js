/*
const passport = require("passport");
require("./passportConfig")(passport);

app.post(
      "/auth/signup",
      passport.authenticate("local-signup", { session: false }),
      (req, res, next) => {
        res.json({
          user: req.user,
        });
      }
    );
    
    app.post(
      "/auth/login",
      passport.authenticate("local-login", { session: false }),
      (req, res, next) => {
        res.json({ user: req.user });
      }
    );
    */