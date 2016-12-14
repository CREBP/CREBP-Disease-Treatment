var express = require('express');

express()
	.use('/assets', express.static('assets'))
	.use('/node_modules', express.static('node_modules'))
	.use('/lib', express.static('lib'))
	.get('/', function (req, res) {
		res.sendFile('./index.html', {root: __dirname});
	})
	.listen(80, function () {
		console.log('App listening at http://localhost:80');
	});
