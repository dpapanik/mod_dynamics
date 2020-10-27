

/********** NOT IN USE BUT GOOD TO HAVE **********/
/********** NOT IN USE BUT GOOD TO HAVE **********/
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
function getVehicleIDs(trips){
	var vehicles = [];
	trips.forEach(function(trip) {
		if (!vehicles.includes(trip.bikeid)) {
			vehicles.push(trip.bikeid);
		}
	});
	return vehicles;
}
function getVehicles(trips){
	var vehicles = [];
	var vehicleIDs = new Set();
	trips.forEach(function(trip) {
		if (!vehicleIDs.has(trip.bikeid)) {
			vehicles.push({
				id : trip.bikeid,
				type: 'vehicle'
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


/********** IN PROGRESS **********/
/********** IN PROGRESS **********/
// Use this to average an array of stocks, e.g. the outcome of getDataPerDay(trips, startDate, endDate);
function averageValuesStack(flowRates){
	var averageFlowRates = flowRates[0].map(function(d,k){
		var avgFlowRate = {};
		for (p in d) avgFlowRate[p]=d[p];
		avgFlowRate.values.forEach(function(entry,i){
			entry.inFlows_full = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].inFlows_full});
			entry.outFlows_full = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].outFlows_full});
			entry.inFlows_empty = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].inFlows_empty});
			entry.outFlows_empty = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].outFlows_empty});
		})
	})
  return averageFlowRates;
}
function setCorrectionFlowRates(stocks){
	console.log("making correction flow rates...");
	stocks.filter(function(d){return d.type=="station"}).forEach(function(stock,k){
		stock.values.forEach(function(tStep,i){
			var allDispatchOutFlowRates = d3.sum(stocks, function(_stock){
				if (_stock.type=="station"){
					var diff = _stock.values[i].inFlows_full-_stock.values[i].outFlows_full;
					if (diff>=0){
						return diff;
					} else {
						return 0;
					}
				}
			});
			var allDispatchInFlowRatesDemand = d3.sum(stocks, function(_stock){
				if (_stock.type=="station"){
					var diff = _stock.values[i].inFlows_full-_stock.values[i].outFlows_full;
					if (diff>=0){
						return 0;
					} else {
						return -diff;
					}
				}
			});

			var diff = tStep.inFlows_full-tStep.outFlows_full;
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
function correctDynamics(stocks, dispatchWeight, dispatchDelay){
	// this function can be addedd after setFlowRatesFromTrips(trips, stocks, timeStep) and integrateLevelsFromFlowRates(vehicles, trips, stocks): it adds correction flows and re-integrates dynamics
	console.log("correcting dynamics...");
	for (var i=0; i<stocks[0].values.length; i++){
		stocks.forEach(function(stock){
			if (i==0){
				stock.values[i].bikes = stock.initial;
				stock.values[i].bikesUncorrected = stock.initial;
			} else {
				stock.values[i].bikes = stock.values[i-1].bikes - stock.values[i-1].outFlows_full + stock.values[i-1].inFlows_full - stock.values[i-1].dispatchOutFlowRate + stock.values[i-1].dispatchInFlowRate;
				stock.values[i].bikesUncorrected = stock.values[i-1].bikesUncorrected - stock.values[i-1].outFlows_full + stock.values[i-1].inFlows_full;
			}
		});

		var allDiff =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
			return -Math.min(0, d.values[i].inFlows_full-d.values[i].outFlows_full + d.values[i].dispatchInFlowRate-d.values[i].dispatchOutFlowRate);
		});
		var dispatchedBikesInTransit = stocks.filter(function(d){return d.type=="dispatched"})[0].values[i].bikes;

		stocks.forEach(function(stock){
			if(stock.type=="station"){
				var netInFlowRate = stock.values[i].inFlows_full-stock.values[i].outFlows_full + stock.values[i].dispatchInFlowRate-stock.values[i].dispatchOutFlowRate;
				// // works (?): corrects both trends and occupancies with delay
				// stock.values[i].dispatchOutFlowRate =+ netInFlowRate>=0 ? dispatchWeight * netInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ netInFlowRate>=0 ? 0 : -(netInFlowRate/allDiff) * dispatchedBikesInTransit / dispatchDelay;

				// // works (?): corrects only trends with delay
				// var allNegativeTrends =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){ return d.stats.trend>=0 ? 0 : d.stats.trend});
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? dispatchWeight * stock.stats.trend * stock.values[i].inFlows_full : 0;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? 0 :  (stock.stats.trend/allNegativeTrends) * dispatchedBikesInTransit / dispatchDelay;

				// works: corrects both trends and occupancies
				// stock.values[i].dispatchOutFlowRate =+ netInFlowRate>=0 ? dispatchWeight * netInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ netInFlowRate>=0 ? 0 : -dispatchWeight *netInFlowRate;

				// // works: corrects only trends
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? dispatchWeight * stock.stats.trend * stock.values[i].inFlows_full : 0;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? 0 : - dispatchWeight * stock.stats.trend * stock.values[i].outFlows_full;

				// works: corrects only occupancies
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? (1-stock.stats.trend) * stock.values[i].inFlows_full : stock.values[i].inFlows_full;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? stock.values[i].outFlows_full : (1+stock.stats.trend) * stock.values[i].outFlows_full;
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
