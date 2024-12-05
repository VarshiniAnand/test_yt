//Import all dependencies
const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");//to upload images
const path = require("path");//Include path from express server - using this we will be able to access backend directory
const cors = require("cors");

app.use(express.json());//whatever request we get it will be parsed into json automatically
app.use(cors()); //using this our reactjs project will connect to express port on 4000

// Database connect with MongoDB
mongoose.connect("mongodb+srv://varshu1112:Sh%4016032019@cluster0.utdjk.mongodb.net/e-commerce")

// API creation

app.get("/", (req, res)=>{
    res.send("Express App is Running");
})

const _dirname = path.resolve();
app.use(express.static(path.join(_dirname, '/frontend/dist')));
app.get('/addproducts', (_, res)=> {
    res.sendFile(path.resolve(_dirname, 'frontend', 'dist', 'index.html'))
})
// Image Storage Engine

const multer_storage = multer.diskStorage({
    destination: './upload/images',//folder name in backend
    filename: (req, file, cb)=>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage: multer_storage})

//Creating Upload Endpoint for images
app.use('/images', express.static('upload/images'));

app.post("/upload", upload.single('product'),(req, res)=>{
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

// Schema for creating products

const Products = mongoose.model("Product", {
    id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    image:{
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    new_price: {
        type: Number,
        required: true
    },
    old_price: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    available: {
        type: Boolean,
        default: true
    }
});

app.post('/addproduct',async (req,res)=>{
    let products = await Products.find({});
    let id;
    if(products.length > 0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    } else {
        id = 1;
    }
    const product = new Products({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });
    console.log("product", product);
    await product.save();//to save in mongodb database
    console.log("Saved");

    res.json({
        success: true,
        name: req.body.name,
    })
});

// Creating API for deleting products

app.post("/removeproduct", async (req, res)=>{
    await Products.findOneAndDelete({id: req.body.id});
    console.log("Removed");
    res.json({
        success: true,
        name: req.body.name
    })
});

// Creating API to get all Products
app.get("/allproducts", async (req, res)=>{
    let products = await Products.find({});
    console.log("all products fetched", products);
    res.send(products);
})

//Schema creation for user model
const Users = mongoose.model('Users', {
    name: {
        type: String
    },
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String
    },
    cartData: {
        type: Object
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Creating Endpoint for registering the user
app.post('/signup', async (req, res)=>{
    let check = await Users.findOne({email: req.body.email});
    if(check) {
        return res.status(400).json({success: false, error: "Existing user found with same email address"})
    }
    let cart = {};
    for(let i=0; i < 300; i++) {
        cart[i] = 0;
    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })

    await user.save();

    const data = {
        user: {
            id: user.id
        }
    }

    const token = jwt.sign(data, 'secret_ecom');
    res.json({
        success: true,
        token
    })
})

// Creating Endpoint for user login
app.post('/login', async (req, res)=>{
    let user = await Users.findOne({email: req.body.email});

    if(user) {
        const passCompare = req.body.password === user.password;
        if(passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            }

            const token = jwt.sign(data, 'secret_ecom');
            res.json({success: true, token});
        } else {
            res.json({success: false, errors: "Wrong Password"});
        }
    } else {
        res.json({success: false, errors: "Wrong Email Id"});
    }
})

// Creating endpoint for newCollection data
app.get('/newcollections',async (req, res)=>{
    let products = await Products.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("newcollection")
    res.send(newcollection)
})

// Creating endpoint for popular in women section
app.get('/popularinwomen',async(req, res)=>{
    let products = await Products.find({category: 'women'})
    let popular_in_women = products.slice(0,4)
    console.log("popular in women fetched")
    res.send(popular_in_women)
})

// Creating middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors: "Please authenticate using valid token"})
    } else {
        try {
            const data = jwt.verify(token, 'secret_ecom') //secret_ecom is a secret code it is called as salt
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors: 'please authenticate using a valid token'})
        }
    }
}


// Creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser, async(req, res)=>{
    let userData = await Users.findOne({_id: req.user.id})
    console.log("Added", req.body.itemId)
    userData.cartData[req.body.itemId] += 1
    await Users.findOneAndUpdate({_id:req.user.id}, {cartData: userData.cartData});
    res.send("Added")
})

// Creating end point to remove product from cart data
app.post('/removefromcart', fetchUser, async(req, res)=>{
    let userData = await Users.findOne({_id: req.user.id})
    console.log("removed", req.body.itemId)
    if(userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1
    await Users.findOneAndUpdate({_id:req.user.id}, {cartData: userData.cartData});
    res.send("Removed")
})

// create endpoint to get cart data
app.post("/getcart", fetchUser, async(req, res)=>{
    console.log("getcart")
    let userData = await Users.findOne({_id: req.user.id});
    res.json(userData.cartData);
})

app.listen(port, (error)=>{
    if(!error) {
        console.log("Server running on port "+ port);
    }
    else {
        console.log("Error: "+error);
    }
});