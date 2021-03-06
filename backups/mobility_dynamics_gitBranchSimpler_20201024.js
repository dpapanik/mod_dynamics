// Last Update: Oct 15, 2020
// © Dimitris Papanikolaou

var d3 = require("d3");

/***	FUNCTIONS	***/
/***	FUNCTIONS	***/
/***	FUNCTIONS	***/

// Function getDynamics gets a user trip dataset and a desired timestep as inputs, and
// it returns a JSON object that contains the reconstructed accumulation dynamics time series data as an output
function getDynamics(trips,timeRange){

	var stocksAndVehicles = getStocksAndVehicles(trips, timeRange);
	var stocks = stocksAndVehicles.stocks;
	var vehicles = stocksAndVehicles.vehicles;

	var bundledTrips = getBundledTrips(stocks, trips, timeRange);

	var flowRates = getFlowRates(bundledTrips);
	var seasonalFlowRates = getSeasonalFlowRates(flowRates);
	var trendFlowRates = getTrendFlowRates(flowRates);

	var levels = getLevels(flowRates);
	var seasonalLevels = getLevels(seasonalFlowRates);
	var trendLevels = getLevels(trendFlowRates);

	setDomains(levels);
	setDomains(seasonalLevels);
	setDomains(trendLevels);

	addStats(stocks);

	stocks.sort(sortC); //.sort(sortA)
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
/****** SORTING ALGORITHMS ******/
function sortA(a,b){
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
function sortB(a,b){
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
function sortC(a,b){
	return a.stats.occupancy - b.stats.occupancy;
	if ( !(a.type=='station' && b.type=='station') ) {
		return a.stackOrder-b.stackOrder;
	} else {
		return a.stats.occupancy - b.stats.occupancy;
	}
};
function sortD(a,b){
	if ( !(a.type=='station' && b.type=='station') ) {
		return a.stackOrder-b.stackOrder;
	} else {
		return a.stats.trend - b.stats.trend;
	}
};

/*********   System Setup  *********/

/****** Get Stocks & Vehicles ******/
function getStocksAndVehicles(trips, timeRange){
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
function setBundledTrips(stocks, trips, timeRange){
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
function getBundledTrips(stocks, trips, timeRange){
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
function getFlowRates(bundledTrips){
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
function getSeasonalFlowRates(flowRates){
  // returns a copy of flowRates (stocks) focusing only on trend dynamics
	var result = [];

	flowRates.filter(function(d){return d.type=="station"}).map(function(d){
		var inFlows_full_total = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
		var outFlows_full_total = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
		var trend = inFlows_full_total==0 && outFlows_full_total==0? 0 : (inFlows_full_total-outFlows_full_total)/Math.max(inFlows_full_total,outFlows_full_total);
		var empty_inFlows_full_total = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
		var empty_outFlows_full_total = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
		var empty_trend = empty_inFlows_full_total==0 && empty_outFlows_full_total==0? 0 : (empty_inFlows_full_total-empty_outFlows_full_total)/Math.max(empty_inFlows_full_total,empty_outFlows_full_total);

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
					inFlows_empty : empty_trend>=0 ? (1-empty_trend) * tStep.inFlows_empty : tStep.inFlows_empty,
					outFlows_full : trend>=0 ? tStep.outFlows_full : (1+ trend) * tStep.outFlows_full,
					outFlows_empty : empty_trend>=0 ? tStep.outFlows_empty : (1+ empty_trend) * tStep.outFlows_empty
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
function getTrendFlowRates(flowRates){
  // returns a copy of flowRates (stocks) focusing only on trend dynamics
	var result = [];

	flowRates.filter(function(d){return d.type=="station"}).map(function(d){
		var inFlows_full_total = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
		var outFlows_full_total = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
		var trend = inFlows_full_total==0 && outFlows_full_total==0? 0 : (inFlows_full_total-outFlows_full_total)/Math.max(inFlows_full_total,outFlows_full_total);
		var empty_inFlows_full_total = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
		var empty_outFlows_full_total = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
		var empty_trend = empty_inFlows_full_total==0 && empty_outFlows_full_total==0? 0 : (empty_inFlows_full_total-empty_outFlows_full_total)/Math.max(empty_inFlows_full_total,empty_outFlows_full_total);

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
          inFlows_empty : empty_trend>=0 ? empty_trend * tStep.inFlows_empty : 0,
          outFlows_full : trend>=0 ? 0 : - trend * tStep.outFlows_full,
          outFlows_empty : empty_trend>=0 ? 0 : - empty_trend * tStep.outFlows_empty
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
function setLevels(stocks, initials){
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
function getLevels(flowRates, initials){
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
function setDomains(stocks){
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
function getMinimumInitials(stocks){
	return stocks.map(function(d){
		return d.initial - d.domains.level[0];
	})
}
function getMinimumInitial(stock){
	return stock.initial - stock.domains.level[0];
}

/*********   Add Stats   *********/
function addStats(stocks){
	console.log("adding stats...");
	stocks.forEach(function(d){
		d.stats = (function(){
			var inFlows_full_total = d3.sum(d.values, function(tStep){return tStep.inFlows_full})
			var outFlows_full_total = d3.sum(d.values, function(tStep){return tStep.outFlows_full})
			var inFlows_full_T = (d3.sum(d.values, function(tStep,i){return tStep.inFlows_full * i}) ) / inFlows_full_total;
			var outFlows_full_T = (d3.sum(d.values, function(tStep,i){return Math.abs(tStep.outFlows_full * i)}) ) / outFlows_full_total;
			var trend = (inFlows_full_total-outFlows_full_total)/Math.max(inFlows_full_total,outFlows_full_total);
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
			var occupancy_trend = d3.sum(d.values, function(tStep, i){
				return d3.sum(d.values.slice(0,i+1), function(k){
					if(trend>=0){
						return trend * k.inFlows_full;
					} else {
						return trend * k.outFlows_full
					}
				});
			});
			var occupancy_seasonal = d3.sum(d.values, function(tStep, i){
				return d3.sum(d.values.slice(0,i+1), function(k){
					if(trend>=0){
						return (1-trend) * k.inFlows_full - k.outFlows_full;
					} else {
						return k.outFlows_full - (1-trend) * k.outFlows_full;
					}
				});
			});
			return {
				'trend'	: trend,
				'occupancy' : occupancy,
				'occupancy_positive' : occupancy_positive,
				'occupancy_negative' : occupancy_negative,
				'occupancy_trend' : occupancy_trend,
				'occupancy_seasonal' : occupancy_seasonal,
				'inFlows_full_total' : inFlows_full_total,
				'inFlows_full_T': inFlows_full_T,
				'outFlows_full_total' : outFlows_full_total,
				'outFlows_full_T': outFlows_full_T,
				'res_degree' : inFlows_full_T-outFlows_full_T,
				'sur_degree' : inFlows_full_total-outFlows_full_total,

				'type': (function(){
					var rescom = inFlows_full_T>=outFlows_full_T? 'Res' : 'Com';
					var surshor = inFlows_full_total>=outFlows_full_total? 'Sur' : 'Def';
					return rescom + surshor;
				})(),
				'RCSD': (function(){
					var RCSD = [];
					RCSD[0] = inFlows_full_T>=outFlows_full_T? 'R' : 'C';
					RCSD[1] = inFlows_full_total>=outFlows_full_total? 'S' : 'D';
					return RCSD;
				})()
			};
		})();
	})
}




/*********   Module Exports   *********/
module.exports.getDynamics= getDynamics;
module.exports.sortA= sortA;
module.exports.getStocksAndVehicles= getStocksAndVehicles;
module.exports.setBundledTrips= setBundledTrips;
module.exports.getBundledTrips= getBundledTrips;
module.exports.getFlowRates= getFlowRates;
module.exports.getSeasonalFlowRates= getSeasonalFlowRates;
module.exports.getTrendFlowRates= getTrendFlowRates;
module.exports.setLevels= setLevels;
module.exports.getLevels= getLevels;
module.exports.setLevels= setLevels;
module.exports.setDomains= setDomains;
module.exports.getMinimumInitials= getMinimumInitials;
module.exports.getMinimumInitial= getMinimumInitial;
module.exports.addStats= addStats;
