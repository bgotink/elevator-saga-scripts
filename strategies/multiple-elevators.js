import createStrategy from './base';
import * as log from '../log';

const REASONABLE_DISTANCE = 2;

function findRequestIdx(requests, floor, direction) {
  return requests.findIndex(r => r.floor === floor && r.direction === direction);
}

export default createStrategy(function init(elevators, floors) {
  const nonScheduledRequests = [];

  elevators.forEach((elevator, elevatorNumber) => {
    elevator.on('idle', _ => startElevator(elevator, elevatorNumber));

    elevator.on('schedule', floor => {
      const { direction } = elevator;
      log.info `Got 'schedule' event from elevator ${elevatorNumber}: ${floor} (${direction})`;
      const idx = findRequestIdx(nonScheduledRequests, floor, direction);

      if (idx !== -1) {
        log.info `Unscheduling request for ${floor} (${direction}) because elevator ${elevatorNumber} will pass it by itself`;
        nonScheduledRequests.splice(idx, 1);
      }
    });

    elevator.on('unschedule', floors => {
      const { direction } = elevator;
      floors.forEach(floor => scheduleRequest(floor, direction));
    });
  });

  floors.forEach(floor => {
    floor.on('request-elevator', direction => {
      scheduleRequest(floor, direction);
    });
  });

  function scheduleRequest(floor, direction) {
    if (findRequestIdx(nonScheduledRequests, floor, direction) !== -1) {
      // already requested
      return;
    }

    if (elevators.every(elevator => elevator.isIdle() || direction !== elevator.direction)) {
      nonScheduledRequests.push({ floor, direction });
      startElevators();
      return;
    }

    const passingElevator = elevators.find(elevator => !elevator.isFull() && elevator.willPassBy(floor, direction));
    if (passingElevator != null) {
      passingElevator.schedule(floor);
      return;
    }

    nonScheduledRequests.push({ floor, direction });
  }

  function startElevators() {
    elevators.forEach(startElevator);
  }

  function startElevator(elevator, elevatorNumber) {
    log.info `Calling startElevator(${elevatorNumber})`;

    if (!elevator.isIdle()) {
      log.info `Skipping startElevator(${elevatorNumber}) because elevator is busy`;
      return;
    }
    if (nonScheduledRequests.length === 0) {
      log.info `Skipping startElevator(${elevatorNumber}) because there are no requests`;
      return;
    }

    const { floor: currentFloor } = elevator;
    const freeSpace = elevator.getFreeSpace();
    const requestsToWrite = [];

    log.info `Elevator ${elevatorNumber} is currently at ${currentFloor}, requests are: ${nonScheduledRequests.map(({floor, direction}) => `${floor} (${direction})`).join(', ')}`

    // Heuristic: take the oldest direction requested within a reasonable distance
    let direction = nonScheduledRequests.find(request => request.floor.getDistance(currentFloor) < REASONABLE_DISTANCE);
    if (direction) {
      direction = direction.direction;

      // Reverse loop because we're splicing
      for (let i = nonScheduledRequests.length - 1; i >= 0; i--) {
        const current = nonScheduledRequests[i];
        if (current.direction === direction && (current.floor.getDistance(currentFloor) < REASONABLE_DISTANCE || currentFloor.getDirectionTo(current.floor) === direction)) {
          nonScheduledRequests.splice(i, 1);
          requestsToWrite.push(current);

          if (requestsToWrite.length >= freeSpace) {
            break;
          }
        }
      }
    } else {
      // No close direction found, just take the oldest request
      direction = nonScheduledRequests[0].direction;

      // Reverse loop because we're splicing
      for (let i = nonScheduledRequests.length - 1; i >= 0; i--) {
        const current = nonScheduledRequests[i];
        if (current.direction === direction) {
          nonScheduledRequests.splice(i, 1);
          requestsToWrite.push(current);

          if (requestsToWrite.length >= freeSpace) {
            break;
          }
        }
      }
    }

    log.info `Elevator ${elevatorNumber} is going for a ride ${direction}`;
    log.info `Writing ${requestsToWrite.length} requests to the elevator`;

    requestsToWrite.sort((a, b) => {
      return a.floor.getDirectionTo(b.floor) === direction ? -1 : 1;
    });

    elevator.start(requestsToWrite.map(({ floor }) => floor), direction);
  }
});
