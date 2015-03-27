var _ = require('lodash');
var data = require('./abc.json');

var bipartite = [];

var diseases = _.uniq(_.pluck(data, 'Diseases'));
var diseaseWeight = {};
var interventions = _.uniq(_.pluck(data, 'Interventions'));
var interventionsWeight = {};

_.forEach(data, function(item) {
	var diseaseKey = item.Diseases + '-' + item.Intervention;
	if (!diseaseWeight[diseaseKey]) diseaseWeight[diseaseKey] = 0;
	diseaseWeight[diseaseKey]++;

	var interventionKey = item.Intervention + '-' + item.Diseases;
	if (!interventionsWeight[interventionKey]) interventionsWeight[interventionKey] = 0;
	interventionsWeight[interventionKey]++;
});

_.forEach(diseaseWeight, function(weight, dw) {
	var disease = dw.split('-')[0];
	var intervention = dw.split('-')[1];

	var interventionWeight = interventionsWeight[intervention + '-' + disease];

	if (!interventionWeight) return;

	bipartite.push([
		disease,
		intervention,
		weight,
		interventionWeight,
	]);

	if (weight != interventionsWeight[intervention + '-' + disease]) console.log('ALERT', disease, intervention, weight, interventionsWeight[intervention + '-' + disease]);
});

console.log(bipartite);
