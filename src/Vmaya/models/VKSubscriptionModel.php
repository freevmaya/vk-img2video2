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
			'vk_subscription_id' => [
				'label' => 'vk_subscription_id',
				'dbtype' => 'i'
			],
			'sub_id' => [
				'label' => 'sub_id',
				'dbtype' => 'i'
			],
			'vk_user_id' => [
				'label' => 'vk_user_id',
				'dbtype' => 'i'
			],
			'created_at' => [
				'label' => 'created_at',
				'dbtype' => 's'
			],
			'status' => [
				'label' => 'status',
				'dbtype' => 's'
			],
			'cancel_reason' => [
				'label' => 'cancel_reason',
				'dbtype' => 's'
			],
			'expired' => [
				'label' => 'expired',
				'dbtype' => 's'
			]
		];
	}
}