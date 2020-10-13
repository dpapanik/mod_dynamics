//ALGORITHMS FOR MAKING COMBINED TRIPS
//V2 loops forwards, uses startDates as references and adjusts endDates based on tripDurations
//V3 loops backwards, uses median of startDates and endDates as references and adjusts startDates and endDates based on tripDurations
//V2 groups all empty trips together and all full trips together
//Only V3 creates full and empty trips that alternate. This is because in V2, start times are rounded up

//Algorithm Dimitri v2
//changes the conditions of what qualifies as empty trip: start location of next trip must be different than end location of current trip
function add_empty_trips_v2(trips, threshold){
	console.log("making combined trips...");
	trips.forEach(function(trip,i) {
		trip.end_date=new Date(+trip.start_date+trip.duration * 1000);
		result.push(trip);
		for (var j=i+1; j<trips.length-1; j++){
			var ntrip = trips[j];
			if(ntrip.bikeid==trip.bikeid){ //find the next trip of the same taxi
				if(ntrip.start_station!=trip.end_station){ // Only consider as empty, trips  that connect different locations. Otherwise the vehicle remains idle in the same location
					if(ntrip.start_date<trip.end_date){
						ntrip.start_date=trip.end_date;
					}
					var etrip={};
					etrip.id = tripsCounter++;
					etrip.duration = (+ntrip.start_date - trip.end_date)/1000 <= threshold? (+ntrip.start_date - trip.end_date)/1000 : threshold
					etrip.start_date = trip.end_date;
					etrip.end_date = new Date(+trip.end_date+etrip.duration * 1000);
					etrip.start_station = trip.end_station;
					etrip.start_station_name = trip.end_station_name;
					etrip.start_station_lat = trip.end_station_lat;
					etrip.start_station_lng = trip.end_station_lng;
					etrip.end_station = ntrip.start_station;
					etrip.end_station_name = ntrip.start_station_name;
					etrip.end_station_lat = ntrip.start_station_lat;
					etrip.end_station_lng = ntrip.start_station_lng;
					etrip.bikeid = trip.bikeid;
					etrip.trip_id = trip.trip_id + "_" + ntrip.trip_id;
					etrip.type = "empty";
					trips.push(etrip);
					break;
				} else {
					break; // if the next trip of the same taxi has origin same as current trip's destination, do not consider any other trips from the same taxi
				}
			}
		}
	})
	trips.sort(function(a,b){return a.start_date-b.start_date});
	return trips;
}

//Algorithm Dimitri v3
//Loops backwards, uses median of startDates and endDates as references and adjusts startDates and endDates based on tripDurations
function add_empty_trips_v3(trips, threshold){
	console.log("making combined trips...");
	trips.forEach(function(trip,i) {
		trip.start_date = new Date((+trip.start_date+ +trip.end_date-trip.duration*1000)/2);
		trip.end_date = new Date(+trip.start_date+trip.duration*1000);
		if (i>1){
			for (var j=i-1; j>=0; j--){
				var ptrip = trips[j];
				if(ptrip.bikeid==trip.bikeid){
					if(ptrip.end_station!=trip.start_station){ // Only consider as empty, trips  that connect different locations. Otherwise the vehicle remains idle in the same location
						if(ptrip.end_date>trip.start_date){
							trip.start_date=ptrip.end_date;
							trip.end_date= new Date(+trip.start_date+trip.duration * 1000);
						}
						var etrip={};
						etrip.id = tripsCounter++;
						etrip.duration = (+trip.start_date - ptrip.end_date)/1000 <= threshold? (+trip.start_date - ptrip.end_date)/1000 : threshold;
						etrip.start_date = ptrip.end_date;
						etrip.end_date = new Date(+ptrip.end_date+etrip.duration * 1000);
						etrip.start_station = ptrip.end_station;
						etrip.start_station_name = ptrip.end_station_name;
						etrip.start_station_lat = ptrip.end_station_lat;
						etrip.start_station_lng = ptrip.end_station_lng;
						etrip.end_station = trip.start_station;
						etrip.end_station_name = trip.start_station_name;
						etrip.end_station_lat = trip.start_station_lat;
						etrip.end_station_lng = trip.start_station_lng;
						etrip.bikeid = trip.bikeid;
						etrip.trip_id = ptrip.trip_id + "_" + trip.trip_id;
						etrip.type = "empty";
						trips.push(etrip);
						break;
					} else {
						break; // if the next trip of the same taxi has origin same as current trip's destination, do not consider any other trips from the same taxi
					}
				}
			}
		}
	})
	trips.sort(function(a,b){return a.start_date-b.start_date});
	return trips;
}

//This function returns ONLY the combined (empty+idle) durations
function get_combined_durations(trips){
	var result=[];
	trips.forEach(function(trip,i) {
		trip.start_date = new Date((+trip.start_date+ +trip.end_date-trip.duration*1000)/2);
		trip.end_date = new Date(+trip.start_date+trip.duration*1000);
		if (i>1){
			for (var j=i-1; j>=0; j--){
				var ptrip = trips[j];
				if(ptrip.bikeid==trip.bikeid){
					if(ptrip.end_date>trip.start_date){
						trip.start_date=ptrip.end_date;
						trip.end_date= new Date(+trip.start_date+trip.duration * 1000);
					}
					var etrip={};
					etrip.id = tripsCounter++;
					etrip.duration = (+trip.start_date - ptrip.end_date)/1000;
					etrip.start_date = ptrip.end_date;
					etrip.end_date = new Date(+ptrip.end_date+etrip.duration * 1000);
					etrip.start_station = ptrip.end_station;
					etrip.start_station_name = ptrip.end_station_name;
					etrip.start_station_lat = ptrip.end_station_lat;
					etrip.start_station_lng = ptrip.end_station_lng;
					etrip.end_station = trip.start_station;
					etrip.end_station_name = trip.start_station_name;
					etrip.end_station_lat = trip.start_station_lat;
					etrip.end_station_lng = trip.start_station_lng;
					etrip.bikeid = trip.bikeid;
					etrip.trip_id = ptrip.trip_id + "_" + trip.trip_id;
					etrip.type = "combined";
					result.push(etrip);
					break;
				}
			}
		}
	})
	return result;
}
