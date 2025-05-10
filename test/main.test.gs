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
