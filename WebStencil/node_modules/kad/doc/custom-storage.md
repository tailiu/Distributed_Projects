Creating a storage a adapter for use with Kad is very simple. A storage adapter
is an object with 4 public methods:

* `get(key, callback)`
* `put(key, value, callback)`
* `del(key, callback)`
* `createReadStream()`

The `get()` and `put()` methods are used for handling `STORE` and `FIND_VALUE`
messages. The `del()` method is for handling item expiration. The
`createReadStream()` method is used for periodic replication.

Values are serialized to a `String` before being passed to your storage
adapter and a `String` is expected to be returned when an item is requested.
Callbacks should be called with `(err[, result])` always.

The `createReadStream()` method should return a `stream.Readable` with
`objectMode` enabled and emit `data` event for every item stored until all of
the stored items have been enumerated. The `data` event should include an
object with the following format:

```
{
  key: '<item_key>',
  value: '<json_serialized_item_object>'
}
```
