import test from 'ava';
import * as sinon from 'sinon';
import ow from 'ow';
import {s3} from './fixtures/fake-aws';
import {query} from '../source';

const sandbox = sinon.createSandbox();

test.before(() => {
	sandbox.spy(s3, 'selectObjectContent');
});

test.after(() => {
	sandbox.restore();
});

test('should fail on validation', async t => {
	const fn = query as any;

	await t.throwsAsync(fn(), 'Bucket `undefined` should be a string');
	await t.throwsAsync(fn('mybucket'), 'Key `undefined` should be a string');
	await t.throwsAsync(fn('mybucket', 'foo.json'), 'Expression `undefined` should be a string');
	await t.throwsAsync(
		fn('mybucket', 'foo.json', 'SELECT * FROM S3Object s', {documentType: 'csv'}),
		'Delimiter `undefined` should be a string'
	);
	await t.throwsAsync(
		fn('mybucket', 'foo.json', 'SELECT * FROM S3Object s', {documentType: 'csv', delimiter: '\n'}),
		'Unknown documentType `csv`'
	);
	await t.throwsAsync(
		fn('mybucket', 'foo.json', 'SELECT * FROM S3Object s', {documentType: 'NDJSON', delimiter: '$$'}),
		'Delimiter must have length `1`, found 2'
	);
});

test('should return a promise with all the data', async t => {
	const data = await query('foobarbaz', 'users.ndjson', 'SELECT s.name FROM S3Object s', {
		documentType: 'JSON',
		delimiter: '\n'
	});

	t.deepEqual(data, [
		{
			name: 'Foo'
		},
		{
			name: 'Bar'
		},
		{
			name: 'Foo'
		}
	]);
});

test('should return a stream', async t => {
	const data = await query('foobarbaz', 'users.ndjson', 'SELECT s.name FROM S3Object s', {
		documentType: 'JSON',
		delimiter: '\n',
		stream: true
	});

	t.notThrows(() => ow(data, ow.object));
});

test('should scan a specific range of the file on S3', async t => {
	await query('foobarbaz', 'users.ndjson', 'SELECT s.name FROM S3Object s', {
		delimiter: '\n',
		scanRange: {start: '0', end: '50'}
	});

	t.true(
		(s3.selectObjectContent as sinon.SinonStub).calledWith({
			Bucket: 'foobarbaz',
			Key: 'users.ndjson',
			Expression: 'SELECT s.name FROM S3Object s',
			ExpressionType: 'SQL',
			InputSerialization: {
				JSON: {
					Type: 'LINES'
				},
				CompressionType: 'NONE'
			},
			OutputSerialization: {
				JSON: {
					RecordDelimiter: '\n'
				}
			},
			ScanRange: {
				Start: '0',
				End: '50'
			}
		})
	);
});
