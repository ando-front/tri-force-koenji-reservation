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

describe("isTimeSlotFull", function() {
  it("should return false if the time slot is not full", function() {
    // モックデータの設定
    SpreadsheetApp = {
      openById: function() {
        return {
          getSheetByName: function() {
            return {
              getLastRow: function() {
                return 1; // データがない場合
              },
              getRange: function() {
                return {
                  getValue: function() {
                    return "";
                  }
                };
              }
            };
          }
        };
      }
    };
    var startTime = new Date(2023, 4, 10, 10, 0, 0);
    var facility = "フリーマット";
    var result = isTimeSlotFull(startTime, facility);
    assert(result === false, "should return false");
  });

  it("should return true if the time slot is full", function() {
    // モックデータの設定
    SpreadsheetApp = {
      openById: function() {
        return {
          getSheetByName: function() {
            return {
              getLastRow: function() {
                return 11; // データがある場合
              },
              getRange: function(row, column) {
                if (column === 3) {
                  return {
                    getValue: function() {
                      return "フリーマット";
                    }
                  };
                } else if (column === 10) {
                  return {
                    getValue: function() {
                      return new Date(2023, 4, 10, 10, 0, 0);
                    }
                  };
                } else {
                  return {
                    getValue: function() {
                      return "";
                    }
                  };
                }
              }
            };
          }
        };
      }
    };
    var startTime = new Date(2023, 4, 10, 10, 0, 0);
    var facility = "フリーマット";
    var result = isTimeSlotFull(startTime, facility);
    assert(result === true, "should return true");
  });
});

describe("convertSpreadsheetDate", function() {
  it("should convert a valid spreadsheet date number", function() {
    var spreadsheetDate = 44984.416666666664; // 2023/05/10 10:00
    // モックデータの設定
    SpreadsheetApp = {
      openById: function() {
        return {
          getSpreadsheetLocale: function() {
            return "ja_JP";
          }
        };
      }
    };
    var date = convertSpreadsheetDate(spreadsheetDate, "ja_JP");
    assert(date instanceof Date, "date is not a Date object");
    assert(date.getFullYear() === 2023, "year is incorrect");
    assert(date.getMonth() === 4, "month is incorrect");
    assert(date.getDate() === 10, "date is incorrect");
    assert(date.getHours() === 10, "hours is incorrect");
    assert(date.getMinutes() === 0, "minutes is incorrect");
  });

  it("should convert a valid spreadsheet date string", function() {
    var spreadsheetDate = "2023/05/10 10:00";
    var date = convertSpreadsheetDate(spreadsheetDate, "ja_JP");
    assert(date instanceof Date, "date is not a Date object");
    assert(date.getFullYear() === 2023, "year is incorrect");
    assert(date.getMonth() === 4, "month is incorrect");
    assert(date.getDate() === 10, "date is incorrect");
    assert(date.getHours() === 10, "hours is incorrect");
    assert(date.getMinutes() === 0, "minutes is incorrect");
  });

  it("should return null for an invalid spreadsheet date", function() {
    var spreadsheetDate = "invalid date";
    var date = convertSpreadsheetDate(spreadsheetDate, "ja_JP");
    assert(date === null, "date should be null");
  });
});
