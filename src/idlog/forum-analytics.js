/* eslint-disable linebreak-style */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable linebreak-style */

'use strict';

const { logError } = require('./idlogger');

module.exports.pageView = function (user_id, ip, url) {
	fetch('https://forumanalytics.fly.dev/addPageView', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'a37a9139-4d06-4841-8f07-d1fa0d02d85f',
		},
		body: JSON.stringify({
			Url: url,
			UserId: user_id,
			UserIp: ip,
		}),
	}).then(response => response.text().then(text => console.log('ForumAnalytics success response:', text)))
		.catch(error => logError(`errFA`, `ForumAnalytics send error: ${error}`));
};
