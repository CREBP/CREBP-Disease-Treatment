var _ = require('lodash');
var async = require('async-chainable');
var csvParser = require('csv-parser');
var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var util = require('util');

var options = {
	minRCT: 5, // FILTER: Disguard any RCT link below this limit
};


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
							disease: row[2],
							intervention: row[1],
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
							disease: row[2],
							intervention: row[1],
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
					if (relationship.value < options.minRCT) { // FILTER: Disguard any RCT link below this limit
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

		// Check for gaps in SR from RCT
		.then(function(next) {
			var self = this;
			this.dataR.forEach(function(link) {
				if (_.find(self.dataS, function(l) {
					return l[0] == link[0] && l[1] == link[1];
				}) === undefined) {
					self.dataS.push([
						link[0],
						link[1],
						0,
					]);
				}
			});
			next();
		})

		// Compile sort list of Interventions
		.parallel({
			sortOrderInt: function(next) {
				var sortOrder = {};

				this.dataR.forEach(function(link) {
					if (!sortOrder[link[0]])
						sortOrder[link[0]] = 0;
					sortOrder[link[0]] += link[2];
				});

				next(null, sortOrder);
			},
			sortOrderDis: function(next) {
				var sortOrder = {};

				this.dataR.forEach(function(link) {
					if (!sortOrder[link[1]])
						sortOrder[link[1]] = 0;
					sortOrder[link[1]] += link[2];
				});

				next(null, sortOrder);
			},
		})

		// Sort array by RCT value
		.parallel([
			function(next) {
				var self = this;
				this.dataR.sort(function(a, b) {
					var sortValueIntA = self.sortOrderInt[a[0]] || 0;
					var sortValueIntB = self.sortOrderInt[b[0]] || 0;
					var sortValueDisA = self.sortOrderDis[a[1]] || 0;
					var sortValueDisB = self.sortOrderDis[b[1]] || 0;

					if (sortValueIntA > sortValueIntB) {
						return -1;
					} else if (sortValueIntA < sortValueIntB) {
						return 1;
					} else if (sortValueDisA > sortValueDisB) {
						return -1;
					} else if (sortValueDisA < sortValueDisB) {
						return 1;
					} else {
						return 0;
					}
				});
				next();
			},
			function(next) {
				var self = this;
				this.dataS.sort(function(a, b) {
					var sortValueIntA = self.sortOrderInt[a[0]] || 0;
					var sortValueIntB = self.sortOrderInt[b[0]] || 0;
					var sortValueDisA = self.sortOrderDis[a[1]] || 0;
					var sortValueDisB = self.sortOrderDis[b[1]] || 0;

					a[3] = sortValueIntA + '<=>' + sortValueIntB + '!' + sortValueDisA + '<=>' + sortValueDisB;

					if (sortValueIntA > sortValueIntB) {
						return -1;
					} else if (sortValueIntA < sortValueIntB) {
						return 1;
					} else if (sortValueDisA > sortValueDisB) {
						return -1;
					} else if (sortValueDisA < sortValueDisB) {
						return 1;
					} else {
						return 0;
					}
				});
				next();
			},
		])

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
					.map('disease')
					.uniq()
					.value()
					.length,
				'diseases,',
				_(this.lookupR)
					.map('intervention')
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
					.map('disease')
					.uniq()
					.value()
					.length,
				'diseases,',
				_(this.lookupS)
					.map('intervention')
					.uniq()
					.value()
					.length,
				'interventions )'
			);

			next();
		})

		.end(next);
});
