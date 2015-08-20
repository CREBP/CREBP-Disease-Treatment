var _ = require('lodash');
var async = require('async-chainable');
var csvParser = require('csv-parser');
var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var util = require('util');

var paths = {
	srs: {
		csv: './data/sr-disease-interventions.csv',
		html: './index.html',
	},
};

gulp.task('default', ['build:srs']);

gulp.task('build:srs', function(next) {
	async()
		.limit(50)

		// Read in external data
		.parallel({
			rows: function(next) {
				var rows = [];
				fs.createReadStream(paths.srs.csv)
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
				fs.readFile(paths.srs.html, next);
			},
		})

		// Process data into a hash
		.set('lookup', {})
		.forEach('rows', function(next, row) {
			var key = row[1] + '-' + row[2];
			if (this.lookup[key]) {
				this.lookup.value++;
			} else {
				this.lookup[key] = {
					disease: row[1],
					intervention: row[2],
					value: 1,
				};
			}
			next();
		})

		// Format back into an array
		.set('data', [])
		.forEach('lookup', function(next, relationship) {
			if (!relationship.disease || !relationship.intervention) return next();
			this.data.push([
				relationship.disease,
				relationship.intervention,
				relationship.value,
			]);
			next();
		})

		// Write file
		.then(function(next) {
			fs.writeFile(paths.srs.html, this.html
				.toString()
				.replace(/\/\/ AUTO-INSERTED DATA {{{[\s\S]+?}}}/, '// AUTO-INSERTED DATA {{{\n' + util.inspect(this.data) + ';\n// }}}')
			, next);
		})

		// Print statistics
		.then(function(next) {
			gutil.log(
				'SR Diseases:',
				_(this.lookup)
					.pluck('disease')
					.uniq()
					.value()
					.length
			);

			gutil.log(
				'SR Interventions:',
				_(this.lookup)
					.pluck('intervention')
					.uniq()
					.value()
					.length
			);

			next();
		})

		.end(next);
});
