import express from "express";
import mailchimp from "@mailchimp/mailchimp_marketing";
import nodemailer from "nodemailer";
import { Pool } from "pg";
import "dotenv/config";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: +process.env.SMTP_PORT === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

mailchimp.setConfig({
  apiKey : process.env.MAILCHIMP_API_KEY,
  server : process.env.MAILCHIMP_SERVER_PREFIX,
});

const LIST_ID = process.env.MAILCHIMP_LIST_ID;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const __dirname = import.meta.dirname;
const app = express();
const port = process.env.PORT || 3000;

app.set("views", "./views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res, next) => {
  try {
    const [courseRes, researchRes, blogRes] = await Promise.all([
      db.query(`SELECT id,title,description,slug FROM courses
                ORDER BY id DESC LIMIT 3`),
      db.query(`SELECT slug,title,description,keywords,thumbnail FROM researches
                ORDER BY id DESC LIMIT 3`),
      db.query(`SELECT slug,title,subtitle,description,
                       icon_class,thumbnail
                FROM blogs
                ORDER BY id DESC LIMIT 3`),
    ]);

    res.render("home", {
      courses: courseRes.rows,
      researches: researchRes.rows,
      blogs: blogRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/academics/grade-:grade/:lo", async (req, res, next) => {
  const { grade, lo } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT * FROM lectures WHERE grade = $1 AND lo_code = $2 LIMIT 1`,
      [grade, lo.toUpperCase()]
    );
    if (!rows.length)
      return res.render("404", { pageTitle: "404 – Page Not Found" });
    res.render("academics", { lecture: rows[0], pageTitle: "Academics" });
  } catch (err) {
    next(err);
  }
});

app.get("/academics", (req, res) => [
  res.render("academics", { pageTitle: "Academics" }),
]);

app.get("/about-us", (req, res) => [
  res.render("about-us", { pageTitle: "About Us" }),
]);

app.get("/blogs", async (req, res, next) => {
  try {
    const { rows: blogs } = await db.query(
      `SELECT slug, title, subtitle, description,
              icon_class, thumbnail
       FROM blogs
       ORDER BY id DESC`
    );
    res.render("blogs", { pageTitle: "Blogs", blogs });
  } catch (e) {
    next(e);
  }
});

app.get('/blogs/:slug', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM blogs WHERE slug = $1 LIMIT 1', [req.params.slug]
    );
    if (!rows.length) return next();
    const blog = rows[0];

    const { rows: trending } = await db.query(
      `SELECT slug,title,subtitle
       FROM blogs
       WHERE slug <> $1
       ORDER BY id DESC
       LIMIT 3`, [blog.slug]
    );

    res.render('blog', {
      pageTitle : blog.title,
      b         : blog,
      trending
    });

  } catch (e) { next(e); }
});

app.get("/contact-us", (req, res) => {
  res.render("contact-us", {
    pageTitle: "Contact Us",
    msg: req.query.msg,
  });
});

app.get("/researches", async (req, res, next) => {
  try {
    const { rows: researches } = await db.query(
      "SELECT slug, title, description, keywords, thumbnail FROM researches ORDER BY id"
    );
    res.render("researches", { pageTitle: "Researches", researches });
  } catch (e) {
    next(e);
  }
});

app.get('/researches/:slug', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM researches WHERE slug = $1 LIMIT 1', [req.params.slug]
    );
    if (!rows.length) return next();
    const research = rows[0];

    const { rows: trending } = await db.query(
      `SELECT slug,title
       FROM researches
       WHERE slug <> $1
       ORDER BY id DESC
       LIMIT 3`, [research.slug]
    );

    res.render('research', {
      pageTitle : research.title,
      r         : research,
      trending
    });

  } catch (e) { next(e); }
});

app.get("/olympiads", async (req, res, next) => {
  try {
    const { rows: courses } = await db.query(
      "SELECT id, title, description, slug FROM courses ORDER BY id"
    );

    res.render("olympiads", {
      pageTitle: "Olympiads",
      courses,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/olympiads/:courseSlug", async (req, res, next) => {
  const course = await db
    .query("SELECT * FROM courses WHERE slug=$1", [req.params.courseSlug])
    .then((r) => r.rows[0]);
  if (!course) return next();

  const concepts = await db
    .query(
      `SELECT * FROM course_concepts
     WHERE course_id=$1 ORDER BY idx`,
      [course.id]
    )
    .then((r) => r.rows);

  res.render("course", {
    course,
    concepts,
    current: concepts[0],
    pageTitle: course.title,
  });
});

app.get("/olympiads/:courseSlug/:conceptSlug", async (req, res, next) => {
  const { courseSlug, conceptSlug } = req.params;

  const course = await db
    .query("SELECT * FROM courses WHERE slug=$1", [courseSlug])
    .then((r) => r.rows[0]);
  if (!course) return next();

  const concepts = await db
    .query(
      `SELECT * FROM course_concepts
     WHERE course_id=$1 ORDER BY idx`,
      [course.id]
    )
    .then((r) => r.rows);

  const current = concepts.find((c) => c.slug === conceptSlug);
  if (!current) return next();

  res.render("course", { course, concepts, current, pageTitle: course.title });
});

app.post("/newsletter", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.redirect("/contact-us?msg=missing");

  try {
    await mailchimp.lists.addListMember(LIST_ID, {
      email_address: email,
      status: "subscribed",
    });
    return res.redirect("/contact-us?msg=success");
  } catch (err) {
    if (err.status === 400 && err.response?.body?.title === "Member Exists") {
      return res.redirect("/contact-us?msg=exists");
    }
    console.error(err);
    return res.redirect("/contact-us?msg=error");
  }
});

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.redirect("/contact-us?msg=missing");
  }

  const mail = {
    from   : `"Obour Math Club" <${process.env.SMTP_USER}>`,
    replyTo: `"${name}" <${email}>`,
    to: process.env.CONTACT_TO,
    subject: `New message from ObourMathClub.com`,
    text: message,
    html: `<p>${message.replace(/\n/g, "<br>")}</p>
              <p><strong>Reply to:</strong> ${email}</p>`,
  };

  try {
    await transporter.sendMail(mail);
    return res.redirect("/contact-us?msg=sent");
  } catch (err) {
    console.error("Mail error → saving to DB", err.message);

    await db.query(
      "CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, \
        name TEXT, email TEXT, body TEXT, created_at TIMESTAMPTZ DEFAULT now())"
    );
    await db.query("INSERT INTO messages (name,email,body) VALUES ($1,$2,$3)", [
      name,
      email,
      message,
    ]);

    return res.redirect("/contact-us?msg=stored");
  }
});

app.use((req, res) => {
  res.status(404).render("404", {
    pageTitle: "404 – Page Not Found",
  });
});

app.listen(port, () => {
  console.log("Connection Established At http://localhost:" + port);
});
