const SPREADSHEET_ID =
  "1tGKAsQ9xCVCzu1FZxXym1teyH5MtXVRvQP-MLPx0bg8";

const LEARNERS_SHEET = "Learners";
const ATTENDANCE_SHEET = "Attendance";

function doPost(e) {
  try {
    const learnerId = String(e.parameter.learnerId || "").trim();
    const suppliedSecret = String(e.parameter.secret || "");

    const expectedSecret =
      PropertiesService
        .getScriptProperties()
        .getProperty("BACKEND_SECRET");

    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return jsonResponse({
        success: false,
        title: "Access denied",
        message: "Invalid backend secret."
      });
    }

    const result = recordAttendance(learnerId);
    return jsonResponse(result);

  } catch (error) {
    return jsonResponse({
      success: false,
      title: "Server Error",
      message: error.message
    });
  }
}

function recordAttendance(learnerId) {
  learnerId = String(learnerId || "").trim();

  if (!/^J4M_\d{3,}$/.test(learnerId)) {
    return {
      success: false,
      title: "❌ Invalid QR Code",
      name: learnerId,
      message: "This is not a valid learner ID."
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    const learnersSheet = ss.getSheetByName(LEARNERS_SHEET);
    const attendanceSheet = ss.getSheetByName(ATTENDANCE_SHEET);

    if (!learnersSheet || !attendanceSheet) {
      throw new Error("Learners or Attendance sheet was not found.");
    }

    const learnerData = learnersSheet.getDataRange().getValues();

    let learnerName = "";
    let sessionName = "";

    for (let i = 1; i < learnerData.length; i++) {
      const id = String(learnerData[i][0]).trim();

      if (id === learnerId) {
        learnerName = learnerData[i][1];
        sessionName = learnerData[i][2];
        break;
      }
    }

    if (!learnerName) {
      return {
        success: false,
        title: "❌ Learner Not Found",
        name: learnerId,
        message: "Please speak to reception."
      };
    }

    const now = new Date();
    const timezone = Session.getScriptTimeZone();

    const today =
      Utilities.formatDate(now, timezone, "yyyy-MM-dd");

    const attendanceData =
      attendanceSheet.getDataRange().getValues();

    // Find an open attendance record for this learner today.
    for (let i = attendanceData.length - 1; i >= 1; i--) {
      const rowLearnerId =
        String(attendanceData[i][0]).trim();

      let rowDate = "";

      if (attendanceData[i][3] instanceof Date) {
        rowDate =
          Utilities.formatDate(
            attendanceData[i][3],
            timezone,
            "yyyy-MM-dd"
          );
      }

      const checkout = attendanceData[i][5];

      if (
        rowLearnerId === learnerId &&
        rowDate === today &&
        !checkout
      ) {
        const row = i + 1;

        attendanceSheet
          .getRange(row, 6)
          .setValue(now)
          .setNumberFormat("HH:mm");

        attendanceSheet
          .getRange(row, 7)
          .setFormula(`=F${row}-E${row}`)
          .setNumberFormat("[h]:mm");

        const time =
          Utilities.formatDate(now, timezone, "HH:mm");

        return {
          success: true,
          action: "checkout",
          title: "👋 Checked Out",
          name: learnerName,
          session: sessionName,
          time
        };
      }
    }

    // No open record: check the learner in.
    attendanceSheet.appendRow([
      learnerId,
      learnerName,
      sessionName,
      now,
      now,
      "",
      ""
    ]);

    const lastRow = attendanceSheet.getLastRow();

    attendanceSheet
      .getRange(lastRow, 4)
      .setNumberFormat("dd/MM/yyyy");

    attendanceSheet
      .getRange(lastRow, 5)
      .setNumberFormat("HH:mm");

    const time =
      Utilities.formatDate(now, timezone, "HH:mm");

    return {
      success: true,
      action: "checkin",
      title: "✅ Checked In",
      name: learnerName,
      session: sessionName,
      time
    };

  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
