// Last Update: Oct 13, 2020
// © Dimitris Papanikolaou
// This code first creates inFlows and outFlows, then it decomposes inFlows and outFlows into trend and seasonality flows, and then it integrates levels



// In this version:
// changed label 'inTrucks' to 'dispatched'
// added function setCorrectionFlowRates(stocks)
// added function computeDynamicsFromTrips(trips, stocks, timeStep)
// in order to compute correction flows we need to simulate the system like an SD system because correction flows depend on correction stocks


// This version assumes that combined trips are computed before hand and not as part of initialize.
// trips: array of trip JSON objects. Each trip JSON object consists of the following attributes:
// trip = {
// 	id : integer,
// 	duration : integer (seconds),
// 	start_date : Date object,
// 	end_date : Date object,
// 	start_station : String or integer,
// 	start_station_name : String,
// 	start_station_lat : number,
// 	start_station_lng : number,
// 	end_station : String or integer,
// 	end_station_name : String,
// 	end_station_lat : number,
// 	end_station_lng : number,
// 	bikeid : String,
// 	trip_id : String,
// 	type : "full"
// }


/***	GLOBAL VARIABLES	 ***/
/***	GLOBAL VARIABLES	 ***/
/***	GLOBAL VARIABLES	 ***/

var timeFormat = d3.time.format("%H:%M:%S");
var dateFormat = d3.time.format("%m/%d/%Y");
var dateTimeFormat = d3.time.format("%m/%d/%y %H:%M");
var startComputingTime = Date.now();

var startDate = d3.time.format("%Y-%m-%d").parse("2019-06-17");
var endDate = d3.time.format("%Y-%m-%d").parse("2019-06-18");
var timerange = d3.time.minutes(startDate, endDate, 15);
//Create a range of timesteps (in minutes) that will be used to create the bins for sampling stationEvents to create the accumulation dynamics
// minutesRange = d3.time.minutes(startDate, endDate, timeStep);
// minutesRange.filter(function(d){return (d.getDay() == "0" || d.getDay() == "6") ;})




/***	FUNCTIONS	***/
/***	FUNCTIONS	***/
/***	FUNCTIONS	***/

// Function initialize gets a user trip dataset and a desired timestep as inputs, and it returns a JSON object that contains the reconstructed accumulation dynamics time series data as an output
function initialize(trips,timeRange){

	var stocksAndVehicles = getStocksAndVehicles(trips, timeRange);
	var stocks = stocksAndVehicles.stocks;
	var vehicles = stocksAndVehicles.vehicles;

	addBundledTrips(stocks, trips, timeRange);

	var flowRates = getFlowRatesFromBundledTrips(stocks);
	var seasonaTrendlFlowRates = getSeasonaTrendlFlowRates(flowRates);

	integrateLevels(flowRates);
	integrateLevels(seasonaTrendlFlowRates);


	addStats(stocks);
 // correctDynamics(stocks, 1, 1);
	setDomains_v3(stocks);
	setMarginalLevels(stocks);
	stocks.sort(sortC); //.sort(sortA)
	// d3.shuffle(stocks);

	console.log("Total computing time: " + (Date.now() - startComputingTime)/1000 + "seconds" );
	return {stocks: stocks, trips: trips, vehicles: vehicles};
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
	// Best one
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
function addBundledTrips(stocks, trips, timeRange){
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
			stock.values.push(historyEntry);
		})
	})
	return stocks;
}

/******* Get Flow Rates *******/
/******* Get Flow Rates *******/

function getFlowRatesFromBundledTrips(stocks){
	console.log("making flow rates...");
  return stocks.map(function(stock){
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
/**** Decompose Flow Rates ****/

// Get new seasonal/trend flow dynamics (without modifying originals)
function getSeasonalFlowRates(stocks){
  // returns a copy of stocks focusing only on trend dynamics
	var result = [];

	stocks.filter(function(d){return d.type=="station"}).map(function(d){
		var inFlowMass = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
		var outFlowMass = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
		var trend = inFlowMass==0 && outFlowMass==0? 0 : (inFlowMass-outFlowMass)/Math.max(inFlowMass,outFlowMass);
		var empty_inFlowMass = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
		var empty_outFlowMass = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
		var empty_trend = empty_inFlowMass==0 && empty_outFlowMass==0? 0 : (empty_inFlowMass-empty_outFlowMass)/Math.max(empty_inFlowMass,empty_outFlowMass);

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

	stocks.filter(function(d){return d.type=="inTransit"}).map(function(d){
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

	stocks.filter(function(d){return d.type=="dispatched"}).map(function(d){
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
function getTrendFlowRates(stocks){
  // returns a copy of stocks focusing only on trend dynamics
	var result = [];

	stocks.filter(function(d){return d.type=="station"}).map(function(d){
		var inFlowMass = d3.sum(d.values, function(tStep){return tStep.inFlows_full});
		var outFlowMass = d3.sum(d.values, function(tStep){return tStep.outFlows_full});
		var trend = inFlowMass==0 && outFlowMass==0? 0 : (inFlowMass-outFlowMass)/Math.max(inFlowMass,outFlowMass);
		var empty_inFlowMass = d3.sum(d.values, function(tStep){return tStep.inFlows_empty});
		var empty_outFlowMass = d3.sum(d.values, function(tStep){return tStep.outFlows_empty});
		var empty_trend = empty_inFlowMass==0 && empty_outFlowMass==0? 0 : (empty_inFlowMass-empty_outFlowMass)/Math.max(empty_inFlowMass,empty_outFlowMass);

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

	stocks.filter(function(d){return d.type=="inTransit"}).map(function(d){
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

	stocks.filter(function(d){return d.type=="dispatched"}).map(function(d){
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



/****** Integrate Levels ******/
/****** Integrate Levels ******/
function integrateLevels(stocks){
	for (var i=0; i<stocks[0].values.length; i++){
		stocks.forEach(function(d){
			if (i==0){
				d.values[i].level = d.initial;
			} else {
				d.values[i].level = d.values[i-1].level + d.values[i].inFlows_full + d.values[i].inFlows_empty - d.values[i].outFlows_full - d.values[i].outFlows_empty;
			}
		});
	}
}

/********   Set Domains    *******/
function setDomains(stocks){
	console.log("setting domains...");
	stocks.forEach(function(d){
		d.domains = {};
		d.domains.level = d3.extent(d.values, function(d){return d.level});
		d.domains.inFlows_full = d3.extent(d.values, function(d){return d.inFlows_full});
    d.domains.inFlows_empty = d3.extent(d.values, function(d){return d.inFlows_empty});
    d.domains.inFlows_empty = d3.extent(d.values, function(d){return d.inFlows_empty});
    d.domains.outFlows_empty = d3.extent(d.values, function(d){return d.outFlows_empty});
	});
	return stocks;
}

/********   Set Minimum Initials    *******/
function getStocksWithMinimumInitials(stocks){
	return stocks.map(function(d){
		d.initial = d.initial - d.domains.level[0];
		return d;
	})
}


/****** Set Minimum Levels ******/
function addMinimumLevels_test(stocks){
	console.log("adding minimum levels...");
	stocks.forEach(function(d){
		d.values.forEach(function(tStep){
			tStep.levels.minimum_net = tStep.levels.net -d.domains.levels.net[0];
			tStep.levels.minimum_full = tStep.levels.full -d.domains.levels.full[0];
			tStep.levels.minimum_empty = tStep.levels.empty -d.domains.levels.empty[0];
			tStep.levels.minimum_seasonal = tStep.levels.seasonal -d.domains.levels.seasonal[0];
			tStep.levels.minimum_trend = tStep.levels.trend -d.domains.levels.trend[0];
		});
	})
}
function addMarginalLevels(stocks){
	console.log("setting marginal levels...");
	stocks.forEach(function(d){
		d.values.forEach(function(tStep){
			tStep.bikesMarginal= tStep.bikesUncorrected-d.domains.bikesUncorrected[0];
			tStep.bikesMinimum= tStep.bikes-d.domains.bikes[0];
			tStep.bikesUncorrectedSeasonal= tStep.bikesUncorrectedSeasonal-d.domains.bikesUncorrectedSeasonal[0];
			tStep.bikesUncorrectedTrend= tStep.bikesUncorrectedTrend-d.domains.bikesUncorrectedTrend[0];
		});
	})
}
function getMarginalLevels(stocks){
	return stocks.map(function(d){
		d.values = d.values.map(function(tStep){
			var value={};
			value.date = tStep.date;
			value.bikesMarginal= tStep.userLevels-d.domains.userLevels[0];
			value.bikesMinimum= tStep.correctedLevels-d.domains.correctedLevels[0];
			value.userLevelsSeasonalMinimum= tStep.userLevelsSeasonal-d.domains.userLevelsSeasonal[0];
			value.userLevelsTrendMinimum= tStep.userLevelsTrend-d.domains.userLevelsTrend[0];
			return value;
		});
		return d;
	})
}

/*********   Add Stats   *********/
function addStats(stocks){
	console.log("adding stats...");
	stocks.forEach(function(d){
		d.stats = (function(){
			var inFlowMass = d3.sum(d.values, function(tStep){return tStep.userInFlowRate})
			var outFlowMass = d3.sum(d.values, function(tStep){return tStep.userOutFlowRate})
			var inFlow_xCoor = (d3.sum(d.values, function(tStep,i){return tStep.userInFlowRate * i}) ) / inFlowMass;
			var outFlow_xCoor = (d3.sum(d.values, function(tStep,i){return Math.abs(tStep.userOutFlowRate * i)}) ) / outFlowMass;
			var trend = inFlowMass>0 && outFlowMass >0 ? (inFlowMass-outFlowMass)/Math.max(inFlowMass,outFlowMass) : 0;
			var occupancy = d3.sum(d.values, function(tStep, i){
				return d3.sum(d.values.slice(0,i+1), function(k){
					return k.userInFlowRate - k.userOutFlowRate;
				})
			});
			var occupancy_positive = d3.sum(d.values, function(tStep, i){
				return Math.max(0, d3.sum(d.values.slice(0,i+1), function(k){
					return k.userInFlowRate-k.userOutFlowRate;
				}));
			});
			var occupancy_negative = d3.sum(d.values, function(tStep, i){
				return Math.min(0, d3.sum(d.values.slice(0,i+1), function(k){
					return k.userInFlowRate-k.userOutFlowRate;
				}));
			});
			var occupancy_trend = d3.sum(d.values, function(tStep, i){
				return d3.sum(d.values.slice(0,i+1), function(k){
					if(trend>=0){
						return trend * k.userInFlowRate;
					} else {
						return trend * k.userOutFlowRate
					}
				});
			});
			var occupancy_seasonal = d3.sum(d.values, function(tStep, i){
				return d3.sum(d.values.slice(0,i+1), function(k){
					if(trend>=0){
						return (1-trend) * k.userInFlowRate - k.userOutFlowRate;
					} else {
						return k.userOutFlowRate - (1-trend) * k.userOutFlowRate;
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
				'inFlowMass' : inFlowMass,
				'inFlow_xCoor': inFlow_xCoor,
				'outFlowMass' : outFlowMass,
				'outFlow_xCoor': outFlow_xCoor,
				'res_degree' : -occupancy,
				// 'res_degree' : inFlow_xCoor-outFlow_xCoor,
				// 'res_degree' : (d3.sum(stocks.filter(function(d){return d.type=="inTransit"})[0].values, function(tStep,i){return Math.abs(tStep.userOutFlowRate * i)}) ) / d3.sum(stocks.filter(function(d){return d.type=="inTransit"})[0].values, function(tStep){return tStep.userOutFlowRate}) - outFlow_xCoor,
				'sur_degree' : inFlowMass-outFlowMass,

				'type': (function(){
					var rescom = inFlow_xCoor>=outFlow_xCoor? 'Res' : 'Com';
					var surshor = inFlowMass>=outFlowMass? 'Sur' : 'Def';
					return rescom + surshor;
				})(),
				'RCSD': (function(){
					var RCSD = [];
					RCSD[0] = inFlow_xCoor>=outFlow_xCoor? 'R' : 'C';
					RCSD[1] = inFlowMass>=outFlowMass? 'S' : 'D';
					return RCSD;
				})()
			};
		})();
	})
}











/********** NOT IN USE BUT GOOD TO HAVE **********/
/********** NOT IN USE BUT GOOD TO HAVE **********/
/********** NOT IN USE BUT GOOD TO HAVE **********/
/********** NOT IN USE BUT GOOD TO HAVE **********/
/********** NOT IN USE BUT GOOD TO HAVE **********/


/*********   System Setup  *********/
/****** Get Stocks & Vehicles ******/
/****** Get Stocks & Vehicles ******/

function getStationsAndVehiclesFromTrips(trips, timeRange){
	var stations = [];
	var vehicles = [];
	var indexByStationName = d3.map();
	var stationNameByIndex = d3.map();
	var indexByVehicleID = d3.map();
	var vehicleIDByIndex = d3.map();
	var n = 0;
	var k = 0;
	trips.forEach(function(trip) {
		if (!indexByStationName.has(trip.start_station)) {
			stations.push({
				station_id : trip.start_station,
				station_name : trip.start_station_name,
				lat : trip.start_station_lat,
				lng : trip.start_station_lng,
				initial: 0
			});
			stationNameByIndex.set(n, trip.start_station);
			indexByStationName.set(trip.start_station, n++);
		}
		if (!indexByStationName.has(trip.end_station)) {
			stations.push({
				station_id : trip.end_station,
				station_name : trip.end_station_name,
				lat : trip.end_station_lat,
				lng : trip.end_station_lng,
				initial: 0
			});
			stationNameByIndex.set(n, trip.end_station);
			indexByStationName.set(trip.end_station, n++);
		}
		if (!indexByVehicleID.has(trip.bikeid)) {
			vehicles.push({
				vehicle_id : trip.bikeid
			});
			vehicleIDByIndex.set(k, trip.bikeid);
			indexByVehicleID.set(trip.bikeid, k++);
			stations[indexByStationName.get(trip.start_station)].initial++;

		}
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") inTransit_initial++;
			if(trip.type=="empty") dispatched_initial++;
		}
	});
	return {
		stations: stations,
		vehicles: vehicles,
		inTransit_initial: inTransit_initial,
		dispatched_initial: dispatched_initial
	}
}
function makeStocksFromLocations(stations_and_vehicles){
	console.log("making stocks from locations...");

	var stocks = [];

	//Compute stationary stocks
	stations_and_vehicles.stations.forEach(function(station){
		var result = {};
		result.type = 'station';
		result.lat = station.lat;
		result.lng = station.lng;
		result.name = station.station_name;
		result.id = station.station_id;
		result.initial = station.initial;
		result.stackOrder = 10;
		result.values = [];
		stocks.push(result);
	});

	//Compute dispatched stocks
	var dispatchStock = {};
	dispatchStock.type = 'dispatched';
	dispatchStock.name = "dispatched";
	dispatchStock.id = 'dispatched';
	dispatchStock.initial = stations_and_vehicles.dispatched_initial;
	dispatchStock.stackOrder = 1;
	dispatchStock.values = [];
	stocks.push(dispatchStock);

	//Compute transitionary stocks
	var transitionalStock = {};
	transitionalStock.type = 'inTransit';
	transitionalStock.name = "InTransit";
	transitionalStock.id = 'inTransit';
	transitionalStock.initial = stations_and_vehicles.inTransit_initial;
	transitionalStock.stackOrder = 0;
	transitionalStock.values = [];
	stocks.push(transitionalStock);

	return stocks;
}

// Gets stocks and initializes levels at stocks, without and with D3
function getStocks(trips, timeRange){
	var stocks = [];
	var vehicleIDs = [];

  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	trips.forEach(function(trip) {
    if (stocks.find(function(d){return d.name==trip.start_station })==null) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
			vehicleIDs.push(trip.bikeid);
    }
    if (stocks.find(function(d){return d.name==trip.end_station })==null){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
			vehicleIDs.push(trip.bikeid);
    }
		// INITIALIZE locational stocks
		if (!vehicleIDs.includes(trip.bikeid)) {
			stocks.find(function(d){return d.name==trip.start_station }).initial++;
		}
		// INITIALIZE inTransit & dispatched stocks
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") stocks.find(function(d){return d.name=='inTransit'}).initial++;
			if(trip.type=="empty") stocks.find(function(d){return d.name=='dispatched'}).initial++;
		}
	});
	return stocks;
}
function getStocksD3(trips, timeRange){
	var stocks = [];
	var indexByLocation = d3.map();
	var indexByVehicleID = d3.map();
	var n = 0;
	var k = 0;

  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
	indexByLocation.set('inTransit', n++);
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	indexByLocation.set('dispatched', n++);
	trips.forEach(function(trip) {
    if (!indexByLocation.has(trip.start_station)) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
      indexByLocation.set(trip.start_station, n++);
    }
    if (!indexByLocation.has(trip.end_station)){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
      indexByLocation.set(trip.end_station, n++);
    }
		// INITIALIZE locational stocks
		if (!indexByVehicleID.has(trip.bikeid)) {
			indexByVehicleID.set(trip.bikeid, k++);
			stocks[indexByLocation.get(trip.start_station)].initial++;
		}
		// INITIALIZE inTransit & dispatched stocks
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") stocks[indexByLocation.get('inTransit')].initial++;
			if(trip.type=="empty") stocks[indexByLocation.get('dispatched')].initial++;
		}
	});

	return stocks;
}
// Gets stocks, vehicles, and initializes levels at stocks, , without and with D3
function currently_in_use_getStocksAndVehicles(trips, timeRange){
	// Returns vehicles as objects
	// Best one
	var stocks = [];
	var vehicles = [];

  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
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
        stackOrder: 10,
        values : []
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
function getStocksAndVehicleIDs(trips, timeRange){
	// Returns vehicles as strings
	var stocks = [];
	var vehicles = [];

  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	trips.forEach(function(trip) {
    if (stocks.find(function(d){return d.name==trip.start_station })==null) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
    }
    if (stocks.find(function(d){return d.name==trip.end_station })==null){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
    }
		// INITIALIZE locational stocks
		if (!vehicles.includes(trip.bikeid)) {
			vehicles.push(trip.bikeid);
			stocks.find(function(d){return d.name==trip.start_station }).initial++;
		}
		// INITIALIZE inTransit & dispatched stocks
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
function getStocksAndVehiclesD3(trips, timeRange){
	// Returns vehicles as objects
	// Uses d3.map() function
	var stocks = [];
	var vehicles = [];
	var indexByLocation = d3.map();
	var indexByVehicleID = d3.map();
	var n = 0;
	var k = 0;

  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
	indexByLocation.set('inTransit', n++);
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	indexByLocation.set('dispatched', n++);
	trips.forEach(function(trip) {
		if (!indexByLocation.has(trip.start_station)) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
      indexByLocation.set(trip.start_station, n++);
    }
    if (!indexByLocation.has(trip.end_station)){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
      indexByLocation.set(trip.end_station, n++);
    }
		// INITIALIZE locational stocks
		if (!indexByVehicleID.has(trip.bikeid)) {
			vehicles.push({
				vehicle_id : trip.bikeid
			});
			indexByVehicleID.set(trip.bikeid, k++);
			stocks[indexByLocation.get(trip.start_station)].initial++;
		}
		// INITIALIZE inTransit & dispatched stocks
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") stocks[indexByLocation.get('inTransit')].initial++;
			if(trip.type=="empty") stocks[indexByLocation.get('dispatched')].initial++;
		}
	});

	return {
		stocks: stocks,
		vehicles: vehicles
	}
}

// Or each one individually:
function getVehicleIDs(trips){
	var vehicles = [];
	trips.forEach(function(trip) {
		if (!vehicles.includes(trip.bikeid)) {
			vehicles.push(trip.bikeid);
		}
	});
	return vehicles;
}
function getVehiclesFromTrips(trips){
	var vehicles = [];
	var vehicleIDs = new Set();
	trips.forEach(function(trip) {
		if (!vehicleIDs.has(trip.bikeid)) {
			vehicles.push({
				id : trip.bikeid
			});
			vehicleIDs.add(trip.bikeid);
		}
	});
	return vehicles;
}
function getStocksFromTrips(trips){
	var stocks = [];
	var stationIDs = new Set();
  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	trips.forEach(function(trip) {
		if (!stationIDs.has(trip.start_station)) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
      stationIDs.add(trip.start_station);
    }
    if (!stationIDs.has(trip.end_station)){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
			stationIDs.add(trip.end_station);
    }
	});
	return stocks;
}
function setInitialLevels(trips, stocks, timeRange){
	var stockIDs = new Set();
	var vehicleIDs = new Set();
  stocks.forEach(function(stock){
    stockIDs.add(stock.name);
  });
	trips.forEach(function(trip) {
		if (!vehicleIDs.has(trip.bikeid)) {
			vehicleIDs.add(trip.bikeid);
			stocks.find(function(d){return d.name==trip.start_station }).initial++;
		}
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") stocks.find(function(d){return d.name=='inTransit'}).initial++;
			if(trip.type=="empty") stocks.find(function(d){return d.name=='dispatched'}).initial++;
		}
	});
}










// In Progress
//use this function if your data range spans more than one days
function averageValues(stocks, timeStep){
	var today = dateFormat.parse(dateFormat(new Date(Date.now())));
	var tomorrow = new Date(+today+86400000);
	var timeSteps = d3.time.minutes(today, tomorrow, timeStep);
	stocks.forEach(function(stock){
		stock.averageValues = d3.nest()
		.key(function(d) {return d3.time.format("%H:%M:%S")(d.date)})
		.entries(stock.values)
		.map(function(entry, i){
			return{
				time: entry.key,
				date: timeSteps[i],
				bikes:d3.mean(entry.values, function(d){return d.bikes}),
				bikesMarginal:d3.mean(entry.values, function(d){return d.bikesMarginal}),
				bikesMinimum:d3.mean(entry.values, function(d){return d.bikesMinimum}),
				bikesUncorrected:d3.mean(entry.values, function(d){return d.bikesUncorrected}),
				dispatchInFlowRate:d3.mean(entry.values, function(d){return d.dispatchInFlowRate}),
				dispatchOutFlowRate:d3.mean(entry.values, function(d){return d.dispatchOutFlowRate}),
				userInFlowRate:d3.mean(entry.values, function(d){return d.userInFlowRate}),
				userOutFlowRate:d3.mean(entry.values, function(d){return d.userOutFlowRate}),
				// incoming_empty_trips: d3.merge(entry.values, function(d){return d.incoming_empty_trips}),
				// incoming_full_trips: d3.merge(entry.values, function(d){return d.incoming_full_trips}),
				// outgoing_empty_trips: d3.merge(entry.values, function(d){return d.outgoing_empty_trips}),
				// outgoing_full_trips: d3.merge(entry.values, function(d){return d.outgoing_full_trips})
			}
		})
	});
}

// In Progress
function setCorrectionFlowRates(stocks){
	console.log("making correction flow rates...");
	stocks.filter(function(d){return d.type=="station"}).forEach(function(stock,k){
		stock.values.forEach(function(tStep,i){
			var allDispatchOutFlowRates = d3.sum(stocks, function(_stock){
				if (_stock.type=="station"){
					var diff = _stock.values[i].userInFlowRate-_stock.values[i].userOutFlowRate;
					if (diff>=0){
						return diff;
					} else {
						return 0;
					}
				}
			});
			var allDispatchInFlowRatesDemand = d3.sum(stocks, function(_stock){
				if (_stock.type=="station"){
					var diff = _stock.values[i].userInFlowRate-_stock.values[i].userOutFlowRate;
					if (diff>=0){
						return 0;
					} else {
						return -diff;
					}
				}
			});

			var diff = tStep.userInFlowRate-tStep.userOutFlowRate;
			if (diff>=0){
				tStep.dispatchOutFlowRate = diff;
				tStep.dispatchInFlowRate = 0;
			} else {
				tStep.dispatchOutFlowRate = 0;
				tStep.dispatchInFlowRate =  -diff * (allDispatchOutFlowRates/allDispatchInFlowRatesDemand);
			}
		})
	});
	return stocks;
}

// In Progress
function correctDynamics(stocks, dispatchWeight, dispatchDelay){
	// this function can be addedd after setFlowRatesFromTrips(trips, stocks, timeStep) and integrateLevelsFromFlowRates(vehicles, trips, stocks): it adds correction flows and re-integrates dynamics
	console.log("correcting dynamics...");
	for (var i=0; i<stocks[0].values.length; i++){
		stocks.forEach(function(stock){
			if (i==0){
				stock.values[i].bikes = stock.initial;
				stock.values[i].bikesUncorrected = stock.initial;
			} else {
				stock.values[i].bikes = stock.values[i-1].bikes - stock.values[i-1].userOutFlowRate + stock.values[i-1].userInFlowRate - stock.values[i-1].dispatchOutFlowRate + stock.values[i-1].dispatchInFlowRate;
				stock.values[i].bikesUncorrected = stock.values[i-1].bikesUncorrected - stock.values[i-1].userOutFlowRate + stock.values[i-1].userInFlowRate;
			}
		});

		var allDiff =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
			return -Math.min(0, d.values[i].userInFlowRate-d.values[i].userOutFlowRate + d.values[i].dispatchInFlowRate-d.values[i].dispatchOutFlowRate);
		});
		var dispatchedBikesInTransit = stocks.filter(function(d){return d.type=="dispatched"})[0].values[i].bikes;

		stocks.forEach(function(stock){
			if(stock.type=="station"){
				var netInFlowRate = stock.values[i].userInFlowRate-stock.values[i].userOutFlowRate + stock.values[i].dispatchInFlowRate-stock.values[i].dispatchOutFlowRate;
				// // works (?): corrects both trends and occupancies with delay
				// stock.values[i].dispatchOutFlowRate =+ netInFlowRate>=0 ? dispatchWeight * netInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ netInFlowRate>=0 ? 0 : -(netInFlowRate/allDiff) * dispatchedBikesInTransit / dispatchDelay;

				// // works (?): corrects only trends with delay
				// var allNegativeTrends =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){ return d.stats.trend>=0 ? 0 : d.stats.trend});
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? dispatchWeight * stock.stats.trend * stock.values[i].userInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? 0 :  (stock.stats.trend/allNegativeTrends) * dispatchedBikesInTransit / dispatchDelay;

				// works: corrects both trends and occupancies
				// stock.values[i].dispatchOutFlowRate =+ netInFlowRate>=0 ? dispatchWeight * netInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ netInFlowRate>=0 ? 0 : -dispatchWeight *netInFlowRate;

				// // works: corrects only trends
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? dispatchWeight * stock.stats.trend * stock.values[i].userInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? 0 : - dispatchWeight * stock.stats.trend * stock.values[i].userOutFlowRate;

				// works: corrects only occupancies
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? (1-stock.stats.trend) * stock.values[i].userInFlowRate : stock.values[i].userInFlowRate;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? stock.values[i].userOutFlowRate : (1+stock.stats.trend) * stock.values[i].userOutFlowRate;
			}
			if(stock.type=="dispatched"){
				stock.values[i].dispatchInFlowRate = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d.values[i].dispatchOutFlowRate});
				stock.values[i].dispatchOutFlowRate = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d.values[i].dispatchInFlowRate});
			}
			if(stock.type=="inTransit"){
				stock.values[i].dispatchInFlowRate = 0;
				stock.values[i].dispatchOutFlowRate = 0;
			}
		});
	}
	return stocks;
}

// In Progress
function computeDynamicsFromTrips(trips, stocks, timeStep, timeRange){
	//this function can be added in place of setFlowRatesFromTrips(trips, stocks, timeStep) and integrateLevelsFromFlowRates(vehicles, trips, stocks): it computes dynamics and adds correction flows but it is too compound
	console.log("computing stocks and flows from trips...");
	var timeSteps = timeRange;

	timeSteps.forEach(function(tStep,i){
		var tStepTrips = trips.filter(function(trip){return (trip.start_date>=tStep && trip.start_date < new Date(+tStep + timeStep * 60000) || (trip.end_date>=tStep && trip.end_date < new Date(+tStep + timeStep * 60000)) )});
		var incoming_tStepTrips = tStepTrips.filter(function(trip){return trip.end_date < new Date(+tStep + timeStep * 60000) });
		var outgoing_tStepTrips = tStepTrips.filter(function(trip){return trip.start_date>=tStep });

		stocks.forEach(function(stock){
			var historyEntry = {};
			historyEntry.date = tStep;
			if (stock.type=="station"){
				historyEntry.id = stock.id;
				historyEntry.incoming_full_trips = incoming_tStepTrips.filter(function(trip){return trip.end_station==stock.id && trip.type=="full" });
				historyEntry.outgoing_full_trips = outgoing_tStepTrips.filter(function(trip){return trip.start_station==stock.id &&  trip.type=="full" });
				historyEntry.incoming_empty_trips = incoming_tStepTrips.filter(function(trip){return trip.end_station==stock.id && trip.type=="empty" });
				historyEntry.outgoing_empty_trips = outgoing_tStepTrips.filter(function(trip){return trip.start_station==stock.id &&  trip.type=="empty" });
			}
			if (stock.type=="dispatched"){
				historyEntry.id = stock.id;
				historyEntry.incoming_full_trips = [];
				historyEntry.outgoing_full_trips = [];
				historyEntry.incoming_empty_trips = outgoing_tStepTrips.filter(function(trip){return trip.type=="empty" });
				historyEntry.outgoing_empty_trips = incoming_tStepTrips.filter(function(trip){return trip.type=="empty" });
			}
			if (stock.type=="inTransit"){
				historyEntry.id = stock.id;
				historyEntry.incoming_full_trips = outgoing_tStepTrips.filter(function(trip){return trip.type=="full" });
				historyEntry.outgoing_full_trips = incoming_tStepTrips.filter(function(trip){return trip.type=="full" });
				historyEntry.incoming_empty_trips = [];
				historyEntry.outgoing_empty_trips = [];
			}
			stock.values.push(historyEntry);
		})
	});

	timeSteps.forEach(function(tStep,i){
		stocks.forEach(function(stock){
			if (i==0){
				stock.values[i].bikes = stock.initial;
				stock.values[i].bikesUncorrected = stock.initial;
			} else {
				stock.values[i].bikes = stock.values[i-1].bikes - stock.values[i-1].userOutFlowRate + stock.values[i-1].userInFlowRate - stock.values[i-1].dispatchOutFlowRate + stock.values[i-1].dispatchInFlowRate;
				stock.values[i].bikesUncorrected = stock.values[i-1].bikesUncorrected - stock.values[i-1].userOutFlowRate + stock.values[i-1].userInFlowRate;
			}
			stock.values[i].userOutFlowRate = stock.values[i].outgoing_full_trips.length;
			stock.values[i].userInFlowRate = stock.values[i].incoming_full_trips.length;
			stock.values[i].dispatchInFlowRate = stock.values[i].incoming_empty_trips.length;
			stock.values[i].dispatchOutFlowRate = stock.values[i].outgoing_empty_trips.length;
		});
		//Careful: do not put allDiff inside the stocks.forEach loop because it will keep changing on every loop step
		// The allDiff refers to the all differences that stocks had in the previous timestep
		var allDiff =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
			var diff2 = d.values[i].userInFlowRate-d.values[i].userOutFlowRate + d.values[i].dispatchInFlowRate-d.values[i].dispatchOutFlowRate;
			return diff2>=0 ? 0 : -diff2;
		});
		var dispatchedBikesInTransit = stocks.filter(function(d){return d.type=="dispatched"})[0].values[i].bikes;
		var timeStepsDelay = 1;
		stocks.forEach(function(stock){
			if(stock.type=="station"){
				var diff = stock.values[i].userInFlowRate-stock.values[i].userOutFlowRate + stock.values[i].dispatchInFlowRate-stock.values[i].dispatchOutFlowRate;
				stock.values[i].dispatchOutFlowRate =+ diff>=0 ? diff : 0;
				stock.values[i].dispatchInFlowRate =+ diff>=0 ? 0 : -(diff/allDiff) * dispatchedBikesInTransit / timeStepsDelay;
				// stock.values[i].dispatchInFlowRate =+ diff<0 ? -diff : 0;
			}
			if(stock.type=="dispatched"){
				stock.values[i].dispatchInFlowRate = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d.values[i].dispatchOutFlowRate});
				stock.values[i].dispatchOutFlowRate = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d.values[i].dispatchInFlowRate});
			}
			if(stock.type=="inTransit"){
				stock.values[i].dispatchInFlowRate = 0;
				stock.values[i].dispatchOutFlowRate = 0;
			}
		});
	});
	return stocks;
}

// Replaced by newer version: decomposeSeasonalityTrend(stocks)
function seasonalTrendDecomposition(stocks){
	console.log("decomposing trend and seasonality...");
	stocks.filter(function(d){return d.type=="station"}).forEach(function(d){
		d.values.forEach(function(tStep){ tStep.trendInFlowRate= d.stats.trend>=0 ? d.stats.trend * tStep.userInFlowRate : 0;	});
		d.values.forEach(function(tStep){ tStep.trendOutFlowRate= d.stats.trend>=0 ? 0 : - d.stats.trend * tStep.userOutFlowRate;});
		d.values.forEach(function(tStep){ tStep.seasonalInFlowRate= d.stats.trend>=0 ? (1-d.stats.trend) * tStep.userInFlowRate : tStep.userInFlowRate;	});
		d.values.forEach(function(tStep){ tStep.seasonalOutFlowRate= d.stats.trend>=0 ? tStep.userOutFlowRate : (1+ d.stats.trend) * tStep.userOutFlowRate; });

		d.values.forEach(function(tStep,i){
			if (i==0){
				tStep.bikesSeasonal = d.initial;
				tStep.bikesTrend = d.initial;
			}
			else {
				tStep.bikesSeasonal = d.values[i-1].bikesSeasonal - d.values[i-1].seasonalOutFlowRate + d.values[i-1].seasonalInFlowRate;
				tStep.bikesTrend = d.values[i-1].bikesTrend - d.values[i-1].trendOutFlowRate + d.values[i-1].trendInFlowRate;
			}
		});

		d.domains.bikesSeasonal = d3.extent(d.values, function(d){return d.bikesSeasonal});
		d.domains.bikesTrend = d3.extent(d.values, function(d){return d.bikesTrend});

		d.values.forEach(function(tStep){ tStep.bikesSeasonal= tStep.bikesSeasonal-d.domains.bikesSeasonal[0]});
		d.values.forEach(function(tStep){ tStep.bikesTrend= tStep.bikesTrend-d.domains.bikesTrend[0]});
	});

	stocks.filter(function(d){return d.type=="inTransit"}).forEach(function(d){
		d.values.forEach(function(tStep,i){ tStep.trendInFlowRate= d3.sum(stocks.filter(function(d){return d.type=="station"}), function(station){
			return station.values[i].trendOutFlowRate;
		})});
		d.values.forEach(function(tStep,i){ tStep.trendOutFlowRate= d3.sum(stocks.filter(function(d){return d.type=="station"}), function(station){
			return station.values[i].trendInFlowRate;
		})});
		d.values.forEach(function(tStep,i){ tStep.seasonalInFlowRate= d3.sum(stocks.filter(function(d){return d.type=="station"}), function(station){
			return station.values[i].seasonalOutFlowRate;
		})});
		d.values.forEach(function(tStep,i){ tStep.seasonalOutFlowRate= d3.sum(stocks.filter(function(d){return d.type=="station"}), function(station){
			return station.values[i].seasonalInFlowRate;
		})});
		d.values.forEach(function(tStep,i){
			if (i==0){
				tStep.bikesSeasonal = d.initial;
				tStep.bikesTrend = d.initial;
			}
			else {
				tStep.bikesSeasonal = d.values[i-1].bikesSeasonal - d.values[i-1].seasonalOutFlowRate + d.values[i-1].seasonalInFlowRate;
				tStep.bikesTrend = d.values[i-1].bikesTrend - d.values[i-1].trendOutFlowRate + d.values[i-1].trendInFlowRate;
			}
		});
		d.domains.bikesSeasonal = d3.extent(d.values, function(d){return d.bikesSeasonal});
		d.domains.bikesTrend = d3.extent(d.values, function(d){return d.bikesTrend});

		d.values.forEach(function(tStep){ tStep.bikesSeasonal= tStep.bikesSeasonal-d.domains.bikesSeasonal[0]});
		d.values.forEach(function(tStep){ tStep.bikesTrend= tStep.bikesTrend-d.domains.bikesTrend[0]});

	});
	stocks.filter(function(d){return d.type=="dispatched"}).forEach(function(d){
		d.values.forEach(function(tStep,i){ tStep.trendInFlowRate= 0; });
		d.values.forEach(function(tStep,i){ tStep.trendOutFlowRate= 0;});
		d.values.forEach(function(tStep,i){ tStep.seasonalInFlowRate= 0;});
		d.values.forEach(function(tStep,i){ tStep.seasonalOutFlowRate= 0;});
		d.values.forEach(function(tStep,i){
			tStep.bikesSeasonal = 0;
			tStep.bikesTrend = 0;
		});
	});

}
