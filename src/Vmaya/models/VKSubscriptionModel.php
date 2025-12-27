<?
class VKSubscriptionModel extends BaseModel {
	
	protected function getTable() {
		return 'vk_subscription';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'sub_id' => [
				'label' => 'sub_id',
				'dbtype' => 'i'
			],
			'order_id' => [
				'label' => 'order_id',
				'dbtype' => 'i'
			],
			'vk_user_id' => [
				'label' => 'vk_user_id',
				'dbtype' => 'i'
			],
			'created_at' => [
				'label' => 'created_at',
				'dbtype' => 's'
			]
		];
	}
}