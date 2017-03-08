require('dotenv').config();

const express = require('express');
const google = require('googleapis');
const mongodb = require('mongodb');
const moment = require('moment');

const dbUrl = process.env.MLAB_IMAGESEARCH_URI;
const port = process.env.PORT || 3000;
const CX = process.env.SEARCH_ENGINE_ID;
const API_KEY = process.env.SEARCH_ENGINE_API_KEY;

const customsearch = google.customsearch('v1');
const MongoClient = mongodb.MongoClient;
const app = express();

MongoClient.connect(dbUrl, (err, db) => {
	if(err) throw err;

	const collection = db.collection('searches');

	app.get('/', (req, res) => {
		res.writeHead(200, {"Content-Type": "text/plain"});
		res.write('Provide search parameter(s) to /api/imagesearch/ to search for images.\n' +
			'You can include the query ?offset=x to paginate through the results\n' +
			'To see the latest searches go to /api/latest/imagesearch.\n');
		res.end();
	});

	app.get('/api/imagesearch/:search', (req, res) => {
		const now = moment();
		const date = now.format('Do-MMM-YYYY HH:mm:ss');
		const unixTimestamp = now.unix();
		const searchTerm = req.params.search;
		const offset = req.query.offset;
		const start = offset * 10 || 1; // paginate through results with ?offset=x

		customsearch.cse.list({ cx: CX, searchType: 'image', q: searchTerm, auth: API_KEY, start}, (err, data) => {
			if(err) throw err;
			const results = [];

			for(let i = 0; i < 10; i++) {
				const {link, title, snippet } = data.items[i];
				results.push({
					link,
					title,
					snippet,
					metaData: data.items[i].image,
				});
			}

			res.json(results);
		});

		collection.save({searchTerm, date, unixTimestamp}, {upsert: true});
	});

	app.get('/api/latest/imagesearch/', (req, res) => {
		const cursor = collection.find().sort({_id: -1}).limit(10);
		const results = [];
		cursor.toArray().then(arr => {
			arr.forEach((item, i, arr) => {
				results.push(item);
				if(i+1 === arr.length) {
					res.json(results);
				}
			})
		});
	});
});

app.listen(port, () => {
	console.log(`listening on port ${port}...`);
});
