<?
class VKPaymentsModel extends BaseModel {
	
	protected function getTable() {
		return 'vk_payments';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'user_id' => [
				'label' => 'user_id',
				'dbtype' => 'i'
			],
			'app_id' => [
				'label' => 'app_id',
				'dbtype' => 'i'
			],
			'date' => [
				'label' => 'date',
				'dbtype' => 's'
			],
			'item' => [
				'label' => 'item',
				'dbtype' => 's'
			],
			'item_id' => [
				'label' => 'item_id',
				'dbtype' => 's'
			],
			'item_price' => [
				'label' => 'item_price',
				'dbtype' => 'i'
			],
			'item_title' => [
				'label' => 'item_title',
				'dbtype' => 's'
			],
			'order_id' => [
				'label' => 'order_id',
				'dbtype' => 'i'
			],
			'status' => [
				'label' => 'status',
				'dbtype' => 's'
			],
			'receiver_id' => [
				'label' => 'receiver_id',
				'dbtype' => 'i'
			],
			'item_discount' => [
				'label' => 'item_discount',
				'dbtype' => 'i'
			]
		];
	}
}