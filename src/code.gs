/*
Copyright 2023 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// describe ブロックの外で関数を定義
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

describe("parseStartTime", function() {
  it("should parse a valid date string", function() {
    var startTime = parseStartTime("2023-05-10 10:00");
    assert(startTime instanceof Date, "startTime is not a Date object");
    assert(startTime.getFullYear() === 2023, "year is incorrect");
    assert(startTime.getMonth() === 4, "month is incorrect");
    assert(startTime.getDate() === 10, "date is incorrect");
    assert(startTime.getHours() === 10, "hours is incorrect");
    assert(startTime.getMinutes() === 0, "minutes is incorrect");
  });

  it("should throw an error for an invalid date string", function() {
    try {
      parseStartTime("invalid date");
      assert(false, "should have thrown an error");
    } catch (e) {
      assert(e instanceof Error, "should have thrown an Error object");
      assert(e.message === "日付の形式が正しくありません。", "error message is incorrect");
    }
  });
});

describe("calculateEndTime", function() {
  it("should calculate the end time correctly", function() {
    var startTime = new Date("2023-05-10 10:00");
    var endTime = calculateEndTime(startTime);
    assert(endTime.getHours() === 11, "End time should be 11");
  });
});

describe("isSameHour", function() {
  it("should return true if the dates are in the same hour", function() {
    var date1 = new Date("2023-05-10 10:00");
    var date2 = new Date("2023-05-10 10:30");
    assert(isSameHour(date1, date2) === true, "should be true");
  });

  it("should return false if the dates are not in the same hour", function() {
    var date1 = new Date("2023-05-10 10:00");
    var date2 = new Date("2023-05-10 11:00");
    assert(isSameHour(date1, date2) === false, "should be false");
  });
});

function runTests() {
  var adapter = new GasMochaAdapter();
  adapter.run();
  Logger.log(adapter.getSummary());
}
