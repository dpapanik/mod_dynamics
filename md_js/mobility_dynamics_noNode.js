// JS Library Mobility Dynamics
// Last Update: Oct 26, 2020
// © Dimitris Papanikolaou

md = function(){
	var md = {};

	/****** Get Dynamics ******/
	md.getDynamics = function(trips,timeRange){

		var stocksAndVehicles = md.getStocksAndVehicles(trips, timeRange);
		var stocks = stocksAndVehicles.stocks;
		var vehicles = stocksAndVehicles.vehicles;

		var bundledTrips = md.getBundledTrips(stocks, trips, timeRange);

		var flowRates = md.getFlowRates(bundledTrips);
		var seasonalFlowRates = md.getSeasonalFlowRates(flowRates);
		var trendFlowRates = md.getTrendFlowRates(flowRates);

		var levels = md.getLevels(flowRates);
		var seasonalLevels = md.getLevels(seasonalFlowRates);
		var trendLevels = md.getLevels(trendFlowRates);

		md.setDomains(levels);
		md.setDomains(seasonalLevels);
		md.setDomains(trendLevels);

		md.addStats(stocks);

		stocks.sort(md.sortC);
		// d3.shuffle(stocks);

		return {
			stocks: levels,
			seasonalStocks: seasonalLevels,
			trendStocks: trendLevels,
			trips: trips,
			vehicles: vehicles
		};
	}

	/****** SORTING ALGORITHMS ******/
	md.sortA = function(a,b){
		if ( !(a.type=='station' && b.type=='station') ) {
			return a.stackOrder-b.stackOrder;
		} else {
			// ATTENTION return b.stats.res_degree - a.stats.res_degree;
			if (a.stats.res_degree >= 0 && b.stats.res_degree >= 0) {
				return b.stats.sur_degree - a.stats.sur_degree;
			} if (a.stats.res_degree < 0 && b.stats.res_degree < 0) {
				return b.stats.sur_degree - a.stats.sur_degree;
				// return b.stats.sur_degree - a.stats.sur_degree;
			} else if (a.stats.res_degree >= 0 && b.stats.res_degree < 0 || a.stats.res_degree < 0 && b.stats.res_degree >= 0) {
				return b.stats.res_degree - a.stats.res_degree;
			}
		}
	};
	md.sortB = function(a,b){
		if ( !(a.type=='station' && b.type=='station') ) {
			return a.stackOrder-b.stackOrder;
		} else {
			if (a.stats.sur_degree >= 0 && b.stats.sur_degree >= 0) {
				return b.stats.res_degree - a.stats.res_degree;
			} if (a.stats.sur_degree < 0 && b.stats.sur_degree < 0) {
				return b.stats.res_degree - a.stats.res_degree;
			} else if (a.stats.sur_degree >= 0 && b.stats.sur_degree < 0 || a.stats.sur_degree < 0 && b.stats.sur_degree >= 0) {
				return b.stats.res_degree - a.stats.res_degree;
			}
		}
	};
	md.sortC = function(a,b){
		return a.stats.occupancy - b.stats.occupancy;
		if ( !(a.type=='station' && b.type=='station') ) {
			return a.stackOrder-b.stackOrder;
		} else {
			return a.stats.occupancy - b.stats.occupancy;
		}
	};
	md.sortD = function(a,b){
		if ( !(a.type=='station' && b.type=='station') ) {
			return a.stackOrder-b.stackOrder;
		} else {
			return a.stats.trend - b.stats.trend;
		}
	};

	/*********   System Setup  *********/

	/****** Get Stocks & Vehicles ******/
	md.getStocksAndVehicles = function(trips, timeRange){
		// Returns vehicles as objects
		var stocks = [];
		var vehicles = [];

	  stocks.push({
	    type  : 'inTransit',
	    name  : 'inTransit',
	    id    : 'inTransit',
	    initial: 0,
	    domains: {},
	    stackOrder: 0,
	    values : []
	  });
	  stocks.push({
	    type  : 'dispatched',
	    name  : 'dispatched',
	    id    : 'dispatched',
	    initial: 0,
	    domains: {},
	    stackOrder: 1,
	    values : []
	  });
		trips.forEach(function(trip) {
	    if (stocks.find(d => d.name==trip.start_station)==null) {
	      stocks.push({
	        type  : 'station',
	        name  : trip.start_station_name,
	        id    : trip.start_station,
	        lat   : trip.start_station_lat,
	        lng   : trip.start_station_lng,
	        initial: 0,
	        domains: {},
	        stackOrder: 10,
	        values : [],
	      });
	    }
	    if (stocks.find(d => d.name==trip.end_station)==null){
	      stocks.push({
	        type  : 'station',
	        name  : trip.end_station_name,
	        id    : trip.end_station,
	        lat   : trip.end_station_lat,
	        lng   : trip.end_station_lng,
	        initial: 0,
	        domains: {},
	        stackOrder: 10,
	        values : []
	      });
	    }
			if (vehicles.find(d => d.vehicle_id == trip.bikeid)==null) {
				vehicles.push({vehicle_id : trip.bikeid});
				stocks.find(d => d.name==trip.start_station).initial++;
			}
			if(trip.start_date<=timeRange[0]){
				if(trip.type=="full") stocks.find(function(d){return d.name=='inTransit'}).initial++;
				if(trip.type=="empty") stocks.find(function(d){return d.name=='dispatched'}).initial++;
			}
		});
		return {
			stocks: stocks,
			vehicles: vehicles
		}
	}

	/****** Set Bundled Trips ******/
	md.setBundledTrips = function(stocks, trips, timeRange){
		console.log("bundling trips...");
		var timeStep = timeRange[1] - timeRange[0];
		timeRange.forEach(function(tStep,i){
			var tStepTrips = trips.filter(function(trip){return (trip.start_date>=tStep && trip.start_date < new Date(+tStep + timeStep) || (trip.end_date>=tStep && trip.end_date < new Date(+tStep + timeStep)) )});
			var incoming_tStepTrips = tStepTrips.filter(function(trip){return trip.end_date < new Date(+tStep + timeStep) });
			var outgoing_tStepTrips = tStepTrips.filter(function(trip){return trip.start_date>=tStep });
			stocks.forEach(function(stock){
				var historyEntry = {};
				historyEntry.date = tStep;
				if (stock.type=="station"){
					historyEntry.trips_incoming_full = incoming_tStepTrips.filter(function(trip){return trip.end_station==stock.id && trip.type=="full" });
					historyEntry.trips_outgoing_full = outgoing_tStepTrips.filter(function(trip){return trip.start_station==stock.id &&  trip.type=="full" });
					historyEntry.trips_incoming_empty = incoming_tStepTrips.filter(function(trip){return trip.end_station==stock.id && trip.type=="empty" });
					historyEntry.trips_outgoing_empty = outgoing_tStepTrips.filter(function(trip){return trip.start_station==stock.id &&  trip.type=="empty" });
				}
				if (stock.type=="dispatched"){
					historyEntry.trips_incoming_full = [];
					historyEntry.trips_outgoing_full = [];
					historyEntry.trips_incoming_empty = outgoing_tStepTrips.filter(function(trip){return trip.type=="empty" });
					historyEntry.trips_outgoing_empty = incoming_tStepTrips.filter(function(trip){return trip.type=="empty" });
				}
				if (stock.type=="inTransit"){
					historyEntry.trips_incoming_full = outgoing_tStepTrips.filter(function(trip){return trip.type=="full" });
					historyEntry.trips_outgoing_full = incoming_tStepTrips.filter(function(trip){return trip.type=="full" });
					historyEntry.trips_incoming_empty = [];
					historyEntry.trips_outgoing_empty = [];
				}
				stock.values[i] = historyEntry;
			})
		})
		return stocks;
	}

	/****** Get Bundled Trips ******/
	md.getBundledTrips = function(stocks, trips, timeRange){
		console.log("bundling trips...");
		var bundledTrips = stocks.map(function(d){
			var bundle = {};
			for (p in d) bundle[p]=d[p];
			bundle.values = [];
			return bundle;
		});
		var timeStep = timeRange[1] - timeRange[0];
		timeRange.forEach(function(tStep,i){
			var tStepTrips = trips.filter(function(trip){return (trip.start_date>=tStep && trip.start_date < new Date(+tStep + timeStep) || (trip.end_date>=tStep && trip.end_date < new Date(+tStep + timeStep)) )});
			var incoming_tStepTrips = tStepTrips.filter(function(trip){return trip.end_date < new Date(+tStep + timeStep) });
			var outgoing_tStepTrips = tStepTrips.filter(function(trip){return trip.start_date>=tStep });
			bundledTrips.forEach(function(bundle){
				var historyEntry = {};
				historyEntry.date = tStep;
				if (bundle.type=="station"){
					historyEntry.trips_incoming_full = incoming_tStepTrips.filter(function(trip){return trip.end_station==bundle.id && trip.type=="full" });
					historyEntry.trips_outgoing_full = outgoing_tStepTrips.filter(function(trip){return trip.start_station==bundle.id &&  trip.type=="full" });
					historyEntry.trips_incoming_empty = incoming_tStepTrips.filter(function(trip){return trip.end_station==bundle.id && trip.type=="empty" });
					historyEntry.trips_outgoing_empty = outgoing_tStepTrips.filter(function(trip){return trip.start_station==bundle.id &&  trip.type=="empty" });
				}
				if (bundle.type=="dispatched"){
					historyEntry.trips_incoming_full = [];
					historyEntry.trips_outgoing_full = [];
					historyEntry.trips_incoming_empty = outgoing_tStepTrips.filter(function(trip){return trip.type=="empty" });
					historyEntry.trips_outgoing_empty = incoming_tStepTrips.filter(function(trip){return trip.type=="empty" });
				}
				if (bundle.type=="inTransit"){
					historyEntry.trips_incoming_full = outgoing_tStepTrips.filter(function(trip){return trip.type=="full" });
					historyEntry.trips_outgoing_full = incoming_tStepTrips.filter(function(trip){return trip.type=="full" });
					historyEntry.trips_incoming_empty = [];
					historyEntry.trips_outgoing_empty = [];
				}
				bundle.values[i] = historyEntry;
			})
		})
		return bundledTrips;
	}

	/******* Get Flow Rates *******/
	md.getFlowRates = function(bundledTrips){
		console.log("making flow rates...");
	  return bundledTrips.map(function(stock){
	    return{
	      id : stock.id,
	      name : stock.name,
	      type : stock.type,
	      initial : stock.initial,
	      stackOrder: stock.stackOrder,
	      values : stock.values.map(function(tStep){
	        return {
	          date : tStep.date,
	          inFlows_full : tStep.trips_incoming_full.length,
	          inFlows_empty : tStep.trips_incoming_empty.length,
	          outFlows_full : tStep.trips_outgoing_full.length,
	          outFlows_empty : tStep.trips_outgoing_empty.length
	        }
	      })
	    }
	  })
	}

	/**** Decompose Flow Rates ****/
	/**** Get Seasonal Flow Rates ****/
	md.getSeasonalFlowRates = function(flowRates){
	  // returns a copy of flowRates (stocks) focusing only on trend dynamics
		var result = [];

		flowRates.filter(function(d){return d.type=="station"}).map(function(d){
			var inFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
			var outFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
			var trend = inFlows_full_sum==0 && outFlows_full_sum==0? 0 : (inFlows_full_sum-outFlows_full_sum)/Math.max(inFlows_full_sum,outFlows_full_sum);
			var inFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
			var outFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
			var trend_empty = inFlows_empty_sum==0 && outFlows_empty_sum==0? 0 : (inFlows_empty_sum-outFlows_empty_sum)/Math.max(inFlows_empty_sum,outFlows_empty_sum);

			result.push({
				id : d.id,
				name : d.name,
				lat : d.lat,
				lng : d.lng,
				type : "station",
				initial : d.initial,
				values : d.values.map(function(tStep){
					return {
						date : tStep.date,
						inFlows_full : trend>=0 ? (1-trend) * tStep.inFlows_full : tStep.inFlows_full,
						inFlows_empty : trend_empty>=0 ? (1-trend_empty) * tStep.inFlows_empty : tStep.inFlows_empty,
						outFlows_full : trend>=0 ? tStep.outFlows_full : (1+ trend) * tStep.outFlows_full,
						outFlows_empty : trend_empty>=0 ? tStep.outFlows_empty : (1+ trend_empty) * tStep.outFlows_empty
						}
					})
				})
			});

		flowRates.filter(function(d){return d.type=="inTransit"}).map(function(d){
	    result.push({
				id : "inTransit",
				name : "inTransit",
				type : "inTransit",
				initial : d.initial,
				values : d.values.map(function(tStep,i){
					return {
						date : tStep.date,
	          inFlows_full : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].outFlows_full;
	          }),
	          inFlows_empty : 0,
	          outFlows_full : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].inFlows_full;
	          }),
	          outFlows_empty : 0
					}
				})
			});
		});

		flowRates.filter(function(d){return d.type=="dispatched"}).map(function(d){
	     result.push({
				id : "dispatched",
				name : "dispatched",
				type : "dispatched",
				initial : d.initial,
				values : d.values.map(function(tStep,i){
					return {
						date : tStep.date,
	          inFlows_full : 0,
	          inFlows_empty : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].outFlows_empty;
	          }),
	          outFlows_full : 0,
	          outFlows_empty : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].inFlows_empty;
	          })
					}
				})
			});
		});

		return result;
	}

	/**** Get Trend Flow Rates ****/
	md.getTrendFlowRates = function(flowRates){
	  // returns a copy of flowRates (stocks) focusing only on trend dynamics
		var result = [];

		flowRates.filter(function(d){return d.type=="station"}).map(function(d){
			var inFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
			var outFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
			var trend = inFlows_full_sum==0 && outFlows_full_sum==0? 0 : (inFlows_full_sum-outFlows_full_sum)/Math.max(inFlows_full_sum,outFlows_full_sum);
			var inFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
			var outFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
			var trend_empty = inFlows_empty_sum==0 && outFlows_empty_sum==0? 0 : (inFlows_empty_sum-outFlows_empty_sum)/Math.max(inFlows_empty_sum,outFlows_empty_sum);

			result.push({
				id : d.id,
				name : d.name,
				lat : d.lat,
				lng : d.lng,
				type : "station",
				initial : d.initial,
				values : d.values.map(function(tStep){
					return {
						date : tStep.date,
	          inFlows_full : trend>=0 ? trend * tStep.inFlows_full : 0,
	          inFlows_empty : trend_empty>=0 ? trend_empty * tStep.inFlows_empty : 0,
	          outFlows_full : trend>=0 ? 0 : - trend * tStep.outFlows_full,
	          outFlows_empty : trend_empty>=0 ? 0 : - trend_empty * tStep.outFlows_empty
					}
				})
			});
		});

		flowRates.filter(function(d){return d.type=="inTransit"}).map(function(d){
	    result.push({
				id : "inTransit",
				name : "inTransit",
				type : "inTransit",
				initial : d.initial,
				values : d.values.map(function(tStep,i){
					return {
						date : tStep.date,
	          inFlows_full : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].outFlows_full;
	          }),
	          inFlows_empty : 0,
	          outFlows_full : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].inFlows_full;
	          }),
	          outFlows_empty : 0
					}
				})
			});
		});

		flowRates.filter(function(d){return d.type=="dispatched"}).map(function(d){
			 result.push({
				id : "dispatched",
				name : "dispatched",
				type : "dispatched",
				initial : d.initial,
				values : d.values.map(function(tStep,i){
					return {
						date : tStep.date,
	          inFlows_full : 0,
	          inFlows_empty : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].outFlows_empty;
	          }),
	          outFlows_full : 0,
	          outFlows_empty : d3.sum(result.filter(function(d){return d.type=="station"}), function(station){
	            return station.values[i].inFlows_empty;
	          })
					}
				})
			});
		});

		return result;
	}

	/****** Set Levels ******/
	md.setLevels = function(stocks, initials){
		for (var i=0; i<stocks[0].values.length; i++){
			stocks.forEach(function(d, k){
				var initial = initials? initials[k] : d.initial;
				d.level = initial + d3.sum(d.values.slice(0,i+1), function(tStep){
					return tStep.inFlows_full + tStep.inFlows_empty - tStep.outFlows_full - tStep.outFlows_empty;
				});
			});
		}
		return stocks;
	}

	/****** Get Levels ******/
	md.getLevels = function(flowRates, initials){
		return flowRates.map(function(d,k){
			var level = {};
			for (p in d) level[p]=d[p]; // copy properties
			level.values = d.values.map(function(entry,i){
				var levelEntry = {};
				for (p in entry) levelEntry[p]=entry[p]; // copy properties
				var initial = initials? initials[k] : d.initial;
				levelEntry.level = initial + d3.sum(d.values.slice(0,i+1), function(tStep){
					return tStep.inFlows_full + tStep.inFlows_empty - tStep.outFlows_full - tStep.outFlows_empty;
				});
				return levelEntry;
			})
			return level;
		});
	}

	/********   Set Domains    *******/
	md.setDomains = function(stocks){
		console.log("setting domains...");
		stocks.forEach(function(d){
			d.domains = {};
			d.domains.level = d3.extent(d.values, function(d){return d.level});
			d.domains.inFlows_full = d3.extent(d.values, function(d){return d.inFlows_full});
	    d.domains.inFlows_empty = d3.extent(d.values, function(d){return d.inFlows_empty});
	    d.domains.outFlows_full = d3.extent(d.values, function(d){return d.outFlows_full});
	    d.domains.outFlows_empty = d3.extent(d.values, function(d){return d.outFlows_empty});
		});
		return stocks;
	}

	/********   Set Minimum Initials    *******/
	md.getMinimumInitials = function(stocks){
		return stocks.map(function(d){
			return d.initial - d.domains.level[0];
		})
	}
	md.getMinimumInitial = function(stock){
		return stock.initial - stock.domains.level[0];
	}

	/*********   Add Stats   *********/
	md.addStats = function(stocks){
		console.log("adding stats...");
		stocks.forEach(function(d){
			d.stats = (function(){
				var inFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
				var outFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
				var trend = inFlows_full_sum==0 && outFlows_full_sum==0? 0 : (inFlows_full_sum-outFlows_full_sum)/Math.max(inFlows_full_sum,outFlows_full_sum);

				var inFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
				var outFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
				var trend_empty = inFlows_empty_sum==0 && outFlows_empty_sum==0? 0 : (inFlows_empty_sum-outFlows_empty_sum)/Math.max(inFlows_empty_sum,outFlows_empty_sum);

				var inFlows_full_T = (d3.sum(d.values, function(tStep,i){return tStep.inFlows_full * i}) ) / inFlows_full_sum;
				var outFlows_full_T = (d3.sum(d.values, function(tStep,i){return Math.abs(tStep.outFlows_full * i)}) ) / outFlows_full_sum;
				var avgDepArrDist = Math.abs(inFlows_full_T-outFlows_full_T);

				var occupancy = d3.sum(d.values, function(tStep, i){
					return d3.sum(d.values.slice(0,i+1), function(k){
						return k.inFlows_full - k.outFlows_full;
					})
				});
				var occupancy_positive = d3.sum(d.values, function(tStep, i){
					return Math.max(0, d3.sum(d.values.slice(0,i+1), function(k){
						return k.inFlows_full-k.outFlows_full;
					}));
				});
				var occupancy_negative = d3.sum(d.values, function(tStep, i){
					return Math.min(0, d3.sum(d.values.slice(0,i+1), function(k){
						return k.inFlows_full-k.outFlows_full;
					}));
				});

				return {
					'inFlows_full_sum' : inFlows_full_sum,
					'outFlows_full_sum' : outFlows_full_sum,
					'trend'	: trend,

					'inFlows_full_T': inFlows_full_T,
					'outFlows_full_T': outFlows_full_T,
					'avgDepArrDist' : avgDepArrDist,

					'occupancy' : occupancy,
					'occupancy_positive' : occupancy_positive,
					'occupancy_negative' : occupancy_negative,



					'res_degree' : inFlows_full_T-outFlows_full_T,
					'sur_degree' : inFlows_full_sum-outFlows_full_sum,
					'type': (function(){
						var rescom = inFlows_full_T>=outFlows_full_T? 'Res' : 'Com';
						var surshor = inFlows_full_sum>=outFlows_full_sum? 'Sur' : 'Def';
						return rescom + surshor;
					})(),
					'RCSD': (function(){
						var RCSD = [];
						RCSD[0] = inFlows_full_T>=outFlows_full_T? 'R' : 'C';
						RCSD[1] = inFlows_full_sum>=outFlows_full_sum? 'S' : 'D';
						return RCSD;
					})()
				};
			})();
		})
	}

	/*********   Average Values   *********/
	md.averageValues = function(stocks){
		var timeStep = (stocks[0].values[1].date - stocks[0].values[0].date)/(1000 * 60)
		var startDate = d3.time.day(stocks[0].values[Math.round(stocks[0].values.length/2)].date)// get the floor of the middle day
		var endDate = new Date(+startDate+86400000);
		var timeSteps = d3.time.minutes(startDate, endDate, timeStep);
		var avgStocks = stocks.map(function(stock){
			var avgStock = {};
			for (p in stock) avgStock[p]=stock[p];
			avgStock.values = timeSteps.map(function(tStep, i){
				var entry = {};
				var sameTimeSteps = stock.values.filter(function(d){
					return d.date.getHours()==tStep.getHours() && d.date.getMinutes()==tStep.getMinutes();
				});
				for (p in stock.values[i]) {
					entry[p] = d3.mean(sameTimeSteps, function(d){return d[p]});
				}
				entry.date = tStep
				return entry;
			})
			return avgStock;
		});
	  return avgStocks;
	}

	/*********   Get Flow Rate Trends   *********/
	md.getFlowRateTrends = function(stock){
		var inFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
		var outFlows_full_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
		var trend = inFlows_full_sum==0 && outFlows_full_sum==0? 0 : (inFlows_full_sum-outFlows_full_sum)/Math.max(inFlows_full_sum,outFlows_full_sum);
		var inFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
		var outFlows_empty_sum = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
		var trend_empty = inFlows_empty_sum==0 && outFlows_empty_sum==0? 0 : (inFlows_empty_sum-outFlows_empty_sum)/Math.max(inFlows_empty_sum,outFlows_empty_sum);
		return {
			trend: trend,
			trend_empty: trend_empty
		}
	}

	return md;

}();
