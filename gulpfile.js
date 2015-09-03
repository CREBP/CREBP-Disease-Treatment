var _ = require('lodash');
var async = require('async-chainable');
var csvParser = require('csv-parser');
var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var util = require('util');

var paths = {
	html: './index.html',
	srsCsv: './data/sr-disease-interventions.csv',
	rctsCsv: './data/rct-disease-interventions.csv',
};

gulp.task('default', ['build']);

gulp.task('build', function(next) {
	async()
		.limit(50)

		// Read in external data
		.parallel({
			rowsR: function(next) {
				var rows = [];
				fs.createReadStream(paths.rctsCsv)
					.pipe(csvParser())
					.on('data', function(row) {
						var values = _.values(row);
						if (values[0] && values[1] && values[2])
							rows.push(values);
					})
					.on('error', next)
					.on('finish', function() {
						next(null, rows);
					});
			},
			rowsS: function(next) {
				var rows = [];
				fs.createReadStream(paths.srsCsv)
					.pipe(csvParser())
					.on('data', function(row) {
						var values = _.values(row);
						if (values[0] && values[1] && values[2])
							rows.push(values);
					})
					.on('error', next)
					.on('finish', function() {
						next(null, rows);
					});
			},
			html: function(next) {
				fs.readFile(paths.html, next);
			},
		})

		// Process data into a hash
		.parallel({
			lookupS: function(next) {
				var lookup = {};

				this.rowsS.forEach(function(row) {
					var key = row[1] + '-' + row[2];
					if (lookup[key]) {
						lookup[key].value++;
					} else {
						lookup[key] = {
							disease: row[1],
							intervention: row[2],
							value: 1,
						};
					}
				});
				next(null, lookup);
			},
			lookupR: function(next) {
				var lookup = {};

				this.rowsR.forEach(function(row) {
					var key = row[1] + '-' + row[2];
					if (lookup[key]) {
						lookup[key].value++;
					} else {
						lookup[key] = {
							disease: row[1],
							intervention: row[2],
							value: 1,
						};
					}
				});
				next(null, lookup);
			}
		})

		// Format back into an array
		.set('disguardedRcts', 0)
		.parallel({
			dataR: function(next) {
				var self = this;
				var data = [];
				_.forEach(this.lookupR, function(relationship) {
					if (!relationship.disease || !relationship.intervention) return;
					if (relationship.value < 3) { // FILTER: Disguard any RCT link below this limit
						self.disguardedRcts++;
						return;
					}
					data.push([
						relationship.intervention,
						relationship.disease,
						relationship.value,
					]);
				});
				next(null, data);
			},
			dataS: function(next) {
				var self = this;
				var data = [];
				_.forEach(this.lookupS, function(relationship) {
					if (!relationship.disease || !relationship.intervention) return;
					data.push([
						relationship.intervention,
						relationship.disease,
						relationship.value,
					]);
				});
				next(null, data);
			},
		})

		// Write file
		.then(function(next) {
			fs.writeFile(paths.html, this.html
				.toString()
				.replace(/\/\/ AUTO-INSERTED DATA \(SRs\) {{{[\s\S]+?}}}/, '// AUTO-INSERTED DATA (SRs) {{{\n' + util.inspect(this.dataS) + ';\n// }}}')
				.replace(/\/\/ AUTO-INSERTED DATA \(RCTs\) {{{[\s\S]+?}}}/, '// AUTO-INSERTED DATA (RCTs) {{{\n' + util.inspect(this.dataR) + ';\n// }}}')
			, next);
		})

		// Print statistics
		.then(function(next) {
			gutil.log(
				'RCT Papers:',
				_.keys(this.lookupR).length,
				'(',
				_(this.lookupR)
					.pluck('disease')
					.uniq()
					.value()
					.length,
				'diseases,',
				_(this.lookupR)
					.pluck('intervention')
					.uniq()
					.value()
					.length,
				'interventions,',
				this.disguardedRcts,
				' disguarded links)'
			);

			gutil.log(
				'SR Papers:',
				_.keys(this.lookupS).length,
				'(',
				_(this.lookupS)
					.pluck('disease')
					.uniq()
					.value()
					.length,
				'diseases,',
				_(this.lookupS)
					.pluck('intervention')
					.uniq()
					.value()
					.length,
				'interventions )'
			);

			next();
		})

		.end(next);
});
